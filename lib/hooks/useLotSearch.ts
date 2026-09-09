"use client";

import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { searchLots } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/queryKeys";
import type { LotSearchResult } from "@/types/api";

/** The server caps `limit` at 50; 20 is the same page the auction list walks. */
const PAGE_SIZE = 20;

/**
 * The server's own minimum term length, mirrored here.
 *
 * **This does duplicate a server rule, which is normally forbidden** — but a
 * minimum term length is an input *precondition*, not a filter over data, and
 * the drift direction is the safe one: if the server ever raises its minimum,
 * a stale value here produces a 422 that is loud and immediate rather than a
 * quietly wrong result set. The 422 is handled either way.
 */
export const MIN_TERM_LENGTH = 2;

/**
 * Whether a term is worth sending.
 *
 * **A purely numeric term is exempt at any length.** It is an equality on an
 * indexed lot number rather than a substring scan, and every auction has a lot
 * 1 — refusing `7` would break the most obvious search there is.
 */
export function isSearchable(term: string): boolean {
  const trimmed = term.trim();
  if (/^\d+$/.test(trimmed)) return true;
  return trimmed.length >= MIN_TERM_LENGTH;
}

/**
 * A 422 answering a request that carried a cursor.
 *
 * The two 422s this endpoint returns mean opposite things: a short term is the
 * user's input and belongs on the field, a rejected cursor is **our** bug and
 * belongs nowhere near them. Distinguished by whether we sent a cursor at all,
 * which is the only place that fact is still in scope.
 *
 * **It is an `ApiError` carrying the 422 it wraps**, not a bare `Error`. It is
 * a 422 — only a differently-meaning one — and keeping the status is what lets
 * the app-wide retry rule see it for what it is instead of this hook owning a
 * second copy of that rule. The class survives because the screen branches on
 * it; the local retry predicate did not need to.
 */
export class SearchCursorError extends ApiError {
  constructor(cause: unknown) {
    super(422, "That set of results went stale.");
    this.name = "SearchCursorError";
    this.cause = cause;
  }
}

export type LotSearch = {
  lots: LotSearchResult[];
  /** True only while a request for this term is actually outstanding. */
  isPending: boolean;
  error: unknown;
  isFetchingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  /** Throws the pagination walk away and starts it again from page one. */
  restart: () => void;
};

/**
 * Cross-auction lot search, paged.
 *
 * The term is part of the query key, so React Query drops the results of a term
 * the user has already typed past — cancelling in-flight work for free — and
 * the caller only has to debounce what it passes in.
 */
export function useLotSearch(term: string): LotSearch {
  const queryClient = useQueryClient();
  const trimmed = term.trim();
  const enabled = isSearchable(trimmed);

  const query = useInfiniteQuery({
    queryKey: queryKeys.lotSearch(trimmed),
    queryFn: async ({ pageParam }) => {
      try {
        return await searchLots({ q: trimmed, limit: PAGE_SIZE, cursor: pageParam });
      } catch (cause) {
        if (pageParam !== undefined && cause instanceof ApiError && cause.status === 422) {
          throw new SearchCursorError(cause);
        }
        throw cause;
      }
    },
    initialPageParam: undefined as string | undefined,
    // The cursor is opaque — the compound sort key plus a pinned instant. It
    // goes back exactly as it arrived; nothing here parses or builds one.
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore && lastPage.meta.nextCursor ? lastPage.meta.nextCursor : undefined,
    enabled,
    // No local `retry`: every refusal this endpoint returns is a 4xx, and the
    // app-wide default in `providers.tsx` already declines to retry those.
  });

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  const lots = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const restart = useCallback(() => {
    void queryClient.resetQueries({ queryKey: queryKeys.lotSearch(trimmed) });
  }, [queryClient, trimmed]);

  return {
    lots,
    // `enabled: false` also reads as pending in React Query, and a term nobody
    // has finished typing is not a request in flight.
    isPending: enabled && query.isPending,
    error: query.error,
    isFetchingMore: isFetchingNextPage,
    hasMore: hasNextPage,
    loadMore,
    restart,
  };
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { deleteSwipe, listLots, setSwipe } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import { soonestLotDueAt, useDueRefresh } from "@/lib/hooks/useDueRefresh";
import type { LotCard, SwipeDirection } from "@/types/api";

const PAGE_SIZE = 20;
/** Fetch more while there are still cards to look at, never at zero. */
const PREFETCH_THRESHOLD = 6;

/**
 * One reversible thing the user did, newest last.
 *
 * Passes, bid-sheet swipes and skips share this list so undo walks all three in
 * the order they actually happened — undoing a skip that came after a pass must
 * bring the skip back first, not the pass.
 */
type Action =
  | { kind: "decision"; lotId: string; direction: SwipeDirection }
  | { kind: "skip"; lotId: string };

export type LotStack = {
  cards: LotCard[];
  isPending: boolean;
  error: unknown;
  isFetchingMore: boolean;
  exhausted: boolean;
  canUndo: boolean;
  /** Records the swipe and advances the stack. Rolls back if the server refuses. */
  decide: (lot: LotCard, direction: SwipeDirection) => Promise<void>;
  /**
   * Move a lot to the back of the stack without deciding anything. Deliberately
   * local: nothing is sent, nothing is stored, and it is gone on reload — a skip
   * is "not now", not a preference the user then has to manage.
   */
  skip: (lot: LotCard) => void;
  /**
   * Reverse the most recent gesture, whatever it was. A pass or an interested
   * swipe also deletes the swipe server-side; a skip was never sent, so undoing
   * one is pure stack manipulation and sends nothing.
   */
  undo: () => Promise<LotCard | null>;
  refetch: () => void;
};

/**
 * The stack: server-unswiped lots, minus the ones this session has already
 * resolved. Local resolution is what makes a swipe feel instant; the PUT
 * catches up behind it.
 */
export function useLotStack(
  auctionId: string,
  onError: (message: string) => void,
): LotStack {
  const queryClient = useQueryClient();
  const [history, setHistory] = useState<Action[]>([]);

  const query = useInfiniteQuery({
    queryKey: queryKeys.lots(auctionId),
    queryFn: ({ pageParam }) =>
      listLots(auctionId, { limit: PAGE_SIZE, cursor: pageParam ?? undefined }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.meta.hasMore || !lastPage.meta.nextCursor) return undefined;
      const cursor = Number(lastPage.meta.nextCursor);
      return Number.isFinite(cursor) ? cursor : undefined;
    },
  });

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  const resolvedIds = useMemo(
    () =>
      new Set(
        history.filter((entry) => entry.kind === "decision").map((entry) => entry.lotId),
      ),
    [history],
  );

  /** Skipped ids, oldest first; a re-skip counts only at its newest position. */
  const skipped = useMemo(() => {
    const ids = history.filter((entry) => entry.kind === "skip").map((entry) => entry.lotId);
    return ids.filter((id, index) => ids.lastIndexOf(id) === index);
  }, [history]);

  const allLots = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );

  // The soonest closing lot on screen decides when this list re-asks.
  useDueRefresh(soonestLotDueAt(allLots), () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.lots(auctionId) });
  });

  const cards = useMemo(() => {
    const remaining = allLots.filter((lot) => !resolvedIds.has(lot.id));
    if (skipped.length === 0) return remaining;

    // Skipped cards keep their relative order but sit behind everything else.
    const rank = new Map(skipped.map((id, index) => [id, index]));
    const kept = remaining.filter((lot) => !rank.has(lot.id));
    const moved = remaining
      .filter((lot) => rank.has(lot.id))
      .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    return [...kept, ...moved];
  }, [allLots, resolvedIds, skipped]);

  useEffect(() => {
    if (cards.length < PREFETCH_THRESHOLD && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [cards.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const decide = useCallback(
    async (lot: LotCard, direction: SwipeDirection) => {
      setHistory((current) => [...current, { kind: "decision", lotId: lot.id, direction }]);
      try {
        await setSwipe(lot.id, direction);
        // The lot's own cache entry knows about the swipe now.
        queryClient.setQueryData(queryKeys.lot(lot.id), (existing: unknown) =>
          existing && typeof existing === "object"
            ? { ...existing, my_swipe: direction }
            : existing,
        );
      } catch {
        setHistory((current) =>
          current.filter((entry) => !(entry.kind === "decision" && entry.lotId === lot.id)),
        );
        onError("That swipe didn't save. Try again.");
      }
    },
    [queryClient, onError],
  );

  const skip = useCallback((lot: LotCard) => {
    setHistory((current) => [...current, { kind: "skip", lotId: lot.id }]);
  }, []);

  const undo = useCallback(async () => {
    const last = history[history.length - 1];
    if (!last) return null;

    const restored = allLots.find((lot) => lot.id === last.lotId) ?? null;
    setHistory((current) => current.slice(0, -1));

    // A skip never left the device. Dropping it from the history is the whole
    // undo: the lot stops being sorted to the back and returns to its place,
    // which — being the earliest lot still unresolved — is the front.
    if (last.kind === "skip") return restored;

    try {
      await deleteSwipe(last.lotId);
    } catch {
      setHistory((current) => [...current, last]);
      onError("Couldn't undo that. Try again.");
      return null;
    }
    return restored;
  }, [history, allLots, onError]);

  return {
    cards,
    isPending: query.isPending,
    error: query.error,
    isFetchingMore: isFetchingNextPage,
    exhausted: cards.length === 0 && !hasNextPage && !query.isPending,
    canUndo: history.length > 0,
    decide,
    skip,
    undo,
    refetch: () => void query.refetch(),
  };
}

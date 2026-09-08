"use client";

import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { listLots } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import { soonestLotDueAt, useDueRefresh } from "@/lib/hooks/useDueRefresh";
import type { LotCard } from "@/types/api";

const PAGE_SIZE = 20;

export type AuctionBrowse = {
  /**
   * Every lot in the auction, in the server's own lot-number order.
   *
   * **Nothing is ever filtered out by what the user did.** Lots used to
   * disappear as they were passed or saved, and the set was the server's
   * unswiped list minus this session's decisions on top. Swiping is gone, so a
   * lot leaves this list for exactly one reason: it ended and the server stopped
   * returning it.
   */
  lots: LotCard[];
  isPending: boolean;
  error: unknown;
  isFetchingMore: boolean;
  /** Whether more pages exist, and how to ask for them. The list drives this from a sentinel. */
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
};

/** The lots in one auction, paged. */
export function useAuctionBrowse(auctionId: string): AuctionBrowse {
  const queryClient = useQueryClient();

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

  const lots = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );

  // The soonest closing lot on screen decides when this list re-asks.
  useDueRefresh(soonestLotDueAt(lots), () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.lots(auctionId) });
  });

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    lots,
    isPending: query.isPending,
    error: query.error,
    isFetchingMore: isFetchingNextPage,
    hasMore: hasNextPage,
    loadMore,
    refetch: () => void query.refetch(),
  };
}

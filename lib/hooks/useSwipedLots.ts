"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { listMySwipes } from "@/lib/api/endpoints";
import type { SwipeDirection } from "@/types/api";

const PAGE_SIZE = 25;

/**
 * The "Interested" and "Passed" views. `GET /me/swipes` returns lot cards across
 * every auction, already ordered most-recently-swiped first — so this does not
 * re-sort.
 */
export function useSwipedLots(direction: SwipeDirection) {
  const query = useInfiniteQuery({
    queryKey: ["swiped", direction],
    queryFn: ({ pageParam }) =>
      listMySwipes({ direction, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    // Offset paginated: a short page is the last one.
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
  });

  return {
    ...query,
    lots: query.data?.pages.flat() ?? [],
  };
}

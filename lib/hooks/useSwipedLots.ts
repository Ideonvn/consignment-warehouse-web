"use client";

import { useQuery } from "@tanstack/react-query";
import { listAuctions, listLots } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import type { Auction, LotCard, SwipeDirection } from "@/types/api";

export type SwipedLot = { lot: LotCard; auction: Auction };

/**
 * Swipes are only queryable per auction, so the "Interested" and "Passed" views
 * fan out across the auctions the user can see. See NOTES.md — a single
 * `/me/swipes` endpoint would replace this.
 */
export function useSwipedLots(direction: SwipeDirection) {
  const auctions = useQuery({
    queryKey: queryKeys.auctions(),
    queryFn: () => listAuctions({ limit: 50 }),
  });

  const auctionIds = (auctions.data ?? []).map((auction) => auction.id);

  return useQuery({
    queryKey: ["swiped", direction, auctionIds.join(",")],
    enabled: auctions.data !== undefined,
    queryFn: async (): Promise<SwipedLot[]> => {
      const perAuction = await Promise.all(
        (auctions.data ?? []).map(async (auction) => {
          const { data } = await listLots(auction.id, { direction, limit: 100 });
          return data.map((lot) => ({ lot, auction }));
        }),
      );
      return perAuction.flat().sort((a, b) => a.lot.lot_number - b.lot.lot_number);
    },
  });
}

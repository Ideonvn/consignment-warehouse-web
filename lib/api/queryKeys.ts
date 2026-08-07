import type { SwipeDirection } from "@/types/api";

/** One place for cache keys so realtime updates can find the right entries. */
export const queryKeys = {
  auctions: (status?: string) => ["auctions", status ?? "all"] as const,
  auction: (auctionId: string) => ["auction", auctionId] as const,
  lots: (auctionId: string, direction?: SwipeDirection | "stack") =>
    ["lots", auctionId, direction ?? "stack"] as const,
  lot: (lotId: string) => ["lot", lotId] as const,
  bids: (lotId: string) => ["bids", lotId] as const,
  myBids: (activeOnly: boolean) => ["my-bids", activeOnly] as const,
} as const;

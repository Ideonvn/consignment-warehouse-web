/** One place for cache keys so realtime updates can find the right entries. */
export const queryKeys = {
  auctions: (status?: string) => ["auctions", status ?? "all"] as const,
  auction: (auctionId: string) => ["auction", auctionId] as const,
  lots: (auctionId: string) => ["lots", auctionId] as const,
  lot: (lotId: string) => ["lot", lotId] as const,
  bids: (lotId: string) => ["bids", lotId] as const,
  myBids: (activeOnly: boolean) => ["my-bids", activeOnly] as const,
} as const;

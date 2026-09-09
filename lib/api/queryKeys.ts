/** One place for cache keys so realtime updates can find the right entries. */
export const queryKeys = {
  auctions: (status?: string) => ["auctions", status ?? "all"] as const,
  auction: (auctionId: string) => ["auction", auctionId] as const,
  lots: (auctionId: string) => ["lots", auctionId] as const,
  /**
   * Deliberately under the `lots` prefix: `patchLot` writes every cached lot
   * page it can find by walking `["lots"]`, so a search result updates from the
   * socket and from a bid response with no wiring of its own.
   */
  lotSearch: (term: string) => ["lots", "search", term] as const,
  lot: (lotId: string) => ["lot", lotId] as const,
  bids: (lotId: string) => ["bids", lotId] as const,
  myBids: (activeOnly: boolean) => ["my-bids", activeOnly] as const,
} as const;

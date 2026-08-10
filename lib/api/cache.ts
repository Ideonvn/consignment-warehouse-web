import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import type { BidResult, LotCard, LotDetail, MyBid } from "@/types/api";

/**
 * One place that writes lot state into the query cache. Both the bid response
 * and the websocket feed land here, so a component never needs its own wiring.
 */

type LotPatch = Partial<LotCard> &
  Partial<Pick<LotDetail, "am_i_leading" | "my_auto_bid_max_minor" | "scheduled_ends_at">>;

type LotPage = { data: LotCard[]; meta: unknown };
type LotPages = { pages: LotPage[]; pageParams: unknown[] };

function isLotPages(value: unknown): value is LotPages {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as LotPages).pages)
  );
}

export function patchLot(queryClient: QueryClient, lotId: string, patch: LotPatch): void {
  queryClient.setQueryData(queryKeys.lot(lotId), (existing: LotDetail | undefined) =>
    existing ? { ...existing, ...patch } : existing,
  );

  queryClient.setQueriesData({ queryKey: ["lots"] }, (existing: unknown) => {
    if (!isLotPages(existing)) return existing;
    let touched = false;
    const pages = existing.pages.map((page) => ({
      ...page,
      data: page.data.map((lot) => {
        if (lot.id !== lotId) return lot;
        touched = true;
        return { ...lot, ...patch };
      }),
    }));
    return touched ? { ...existing, pages } : existing;
  });
}

export function patchMyBid(
  queryClient: QueryClient,
  lotId: string,
  patch: Partial<MyBid>,
): void {
  queryClient.setQueriesData({ queryKey: ["my-bids"] }, (existing: unknown) => {
    if (!Array.isArray(existing)) return existing;
    const rows = existing as MyBid[];
    let touched = false;
    const next = rows.map((row) => {
      if (row.lot_id !== lotId) return row;
      touched = true;
      return { ...row, ...patch };
    });
    return touched ? next : existing;
  });
}

/**
 * A bid response carries everything needed to update the UI — including the new
 * close time when anti-snipe fired — so nothing here needs a refetch.
 */
export function applyBidResult(queryClient: QueryClient, result: BidResult): void {
  patchLot(queryClient, result.lot_id, {
    current_bid_minor: result.current_bid_minor,
    minimum_next_bid_minor: result.minimum_next_bid_minor,
    bid_count: result.bid_count,
    bid_sequence: result.bid_sequence,
    effective_ends_at: result.effective_ends_at,
    extension_count: result.extension_count,
    am_i_leading: result.am_i_leading,
    my_auto_bid_max_minor: result.my_max_minor,
  });

  patchMyBid(queryClient, result.lot_id, {
    current_bid_minor: result.current_bid_minor,
    minimum_next_bid_minor: result.minimum_next_bid_minor,
    effective_ends_at: result.effective_ends_at,
    my_max_minor: result.my_max_minor,
    am_i_leading: result.am_i_leading,
  });

  // Bid history is paginated, so let it refetch rather than splice a page.
  void queryClient.invalidateQueries({ queryKey: queryKeys.bids(result.lot_id) });
  // The lot may be new to this list, and grouping depends on the outcome.
  void queryClient.invalidateQueries({ queryKey: ["my-bids"] });
}

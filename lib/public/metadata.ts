import { formatMoney } from "@/lib/format/money";
import type { PublicLotDetail } from "@/types/api";

/**
 * How long Next may reuse a metadata fetch.
 *
 * Matched to the endpoint's own `max-age=30`. It has to be stated explicitly:
 * App Router fetches are **uncached by default** and Next does not derive a TTL
 * from the response's `Cache-Control`, so without this a crawler walking 250
 * lots would be 250 origin requests — from Amplify in eu-west-1 to the API in
 * af-south-1, about 150ms each.
 */
export const METADATA_REVALIDATE_SECONDS = 30;

/** The line under the photo in a shared link. Price first: it is what people ask. */
export function lotPreviewDescription(lot: PublicLotDetail, currency = "ZAR"): string {
  const hasBids = lot.current_bid_minor !== null && lot.bid_count > 0;
  const price = hasBids
    ? `Current bid ${formatMoney(lot.current_bid_minor ?? 0, currency)}`
    : `Starting at ${formatMoney(lot.starting_price_minor, currency)}`;
  const bids = lot.bid_count === 1 ? "1 bid" : `${lot.bid_count} bids`;
  return [price, bids, lot.description?.trim()].filter(Boolean).join(" · ").slice(0, 200);
}

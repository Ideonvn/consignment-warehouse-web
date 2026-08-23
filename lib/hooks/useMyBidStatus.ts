"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listMyBids } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";

/**
 * `/me/bids` caps `limit` at 200 and offers no offset, so a bidder with more
 * than that cannot be fully indexed from the client.
 */
const LIMIT = 200;

export type MyBidStatus = "leading" | "outbid" | "none" | "unknown";

/**
 * Whether the user is winning a lot, for layouts that show many lots at once.
 *
 * `LotCardOut` carries no `am_i_leading` — only the detail payload and `/me/bids`
 * do — so this joins the bid list by lot id rather than asking for a new API
 * field. `active_only=false` on purpose: it distinguishes three states where
 * `true` would collapse "outbid" into "renders nothing", and losing is the most
 * useful thing a list can tell someone.
 *
 * **Truncation is never rendered as "you never bid".** If the response comes
 * back saturated at the cap, a lot that isn't in it might be a lot the user has
 * money on that simply fell outside the window — so unmatched lots report
 * `unknown`, and the caller says so out loud instead of quietly asserting a
 * falsehood about someone's own bids.
 */
export function useMyBidStatus(): {
  statusFor: (lotId: string) => MyBidStatus;
  truncated: boolean;
} {
  const { data } = useQuery({
    queryKey: [...queryKeys.myBids(false), LIMIT] as const,
    queryFn: () => listMyBids({ active_only: false, limit: LIMIT }),
  });

  return useMemo(() => {
    const rows = data ?? [];
    const byLot = new Map(rows.map((row) => [row.lot_id, row]));
    // Saturated means "there may be more we cannot see", not "there are exactly
    // this many". Only then is an absent lot ambiguous.
    const truncated = rows.length >= LIMIT;

    return {
      truncated,
      statusFor: (lotId: string): MyBidStatus => {
        const row = byLot.get(lotId);
        if (row) return row.am_i_leading ? "leading" : "outbid";
        if (!data) return "unknown";
        return truncated ? "unknown" : "none";
      },
    };
  }, [data]);
}

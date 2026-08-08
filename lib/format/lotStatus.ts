import type { LotStatus } from "@/types/api";

export type OutcomeTone = "muted" | "danger" | "success";

export type LotOutcome = {
  /** Pill-sized label. */
  label: string;
  tone: OutcomeTone;
  /** A full sentence for the lot detail screen. */
  detail: string;
};

/**
 * How a *closed* lot reads to a bidder.
 *
 * The three terminal states are not interchangeable: winning a lot, losing one
 * to a higher bidder, and a lot that never met its reserve are three different
 * pieces of news. `lot_closed` is the only thing that carries the status — the
 * clock alone can only tell you bidding is over — so this is where that
 * distinction gets spent.
 *
 * Returns `null` while the lot is still open.
 */
export function lotOutcome(
  status: LotStatus,
  options: { clockExpired: boolean; amILeading?: boolean; hasBids?: boolean } = {
    clockExpired: false,
  },
): LotOutcome | null {
  const { clockExpired, amILeading = false, hasBids = false } = options;

  switch (status) {
    case "ended_sold":
      return amILeading
        ? { label: "You won", tone: "success", detail: "You won this lot." }
        : {
            label: "Sold",
            tone: "muted",
            detail: "This lot sold to another bidder.",
          };

    case "ended_reserve_not_met":
      return {
        label: "Reserve not met",
        tone: "danger",
        detail: amILeading
          ? "You were the highest bidder, but bidding ended below the seller's reserve, so the lot didn't sell."
          : "Bidding ended below the seller's reserve, so this lot didn't sell.",
      };

    case "ended_unsold":
      return {
        label: hasBids ? "Unsold" : "No bids",
        tone: "muted",
        detail: hasBids
          ? "This lot closed without selling."
          : "This lot closed without a single bid.",
      };

    case "withdrawn":
      return {
        label: "Withdrawn",
        tone: "muted",
        detail: "The seller withdrew this lot before it closed.",
      };

    case "cancelled":
      return {
        label: "Cancelled",
        tone: "muted",
        detail: "This lot was cancelled.",
      };

    case "scheduled":
      return null;

    case "live":
      // The clock has run out but the backend hasn't published the result yet.
      return clockExpired
        ? {
            label: "Bidding closed",
            tone: "muted",
            detail: "Bidding has closed. The result is being finalised.",
          }
        : null;

    default:
      return clockExpired
        ? { label: "Closed", tone: "muted", detail: "Bidding has closed." }
        : null;
  }
}

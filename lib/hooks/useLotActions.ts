"use client";

import { useCallback, useRef, useState } from "react";
import { useBidSubmit } from "@/lib/hooks/useBidSubmit";
import { useNow } from "@/lib/hooks/useTicker";
import { isLotOpen } from "@/lib/format/time";
import { uuid } from "@/lib/utils/uuid";
import { useToast } from "@/components/ui/Toast";
import type { OneTapOutcome } from "@/components/bid/BidOutcomeSheet";
import type { LotSummary } from "@/types/api";

export type LotActions = {
  /**
   * Place a bid, now.
   *
   * **There is no confirmation and no delay.** A five-second cancel window used
   * to sit between the gesture and `POST /bids`; it is gone, so the press *is*
   * the bid. It bids exactly the server's `minimum_next_bid_minor` with no
   * maximum — raising is offered on the outcome, at the moment being outbid
   * makes its value obvious.
   *
   * The clock, not `status`, decides whether this is offered: the lifecycle
   * worker's tick lags, so a lot can read `live` while the server would already
   * refuse the bid with a 409.
   */
  bidNow: (lot: LotSummary, currency: string) => void;
  /** Opens the sheet, where the one number is the most they will pay. */
  openSheet: (lot: LotSummary) => void;
  /** The lot whose bid sheet is open, if any. */
  bidLot: LotSummary | null;
  closeBidSheet: () => void;
  /** What a placed bid landed on. Rendered by the screen, which owns the sheet. */
  outcome: OneTapOutcome | null;
  clearOutcome: () => void;
  /** The lot to raise on, once they choose to from the outcome. */
  raiseFromOutcome: () => void;
  /**
   * After a too-low refusal: bid the minimum the server's 422 named, on the same
   * lot, through the same path as the row's button. Never called automatically —
   * only from a button that shows that figure.
   */
  rebid: () => void;
  /** Whether that lot is still open on the clock, so the sheet can hold its button. */
  rebidOpen: boolean;
  /** That re-bid is in flight: the sheet's equivalent of the row's `isSubmitting`. */
  rebidding: boolean;
  /** Lot ids with a bid in flight, so a row can hold its button still. */
  isSubmitting: (lotId: string) => boolean;
};

/**
 * What the list's two buttons do.
 *
 * One path to `POST /bids` and one to the sheet, so the row cannot grow a second
 * opinion about what a press means — and that disagreement would be money.
 *
 * `lots` is what the screen currently renders. The outcome sheet's re-bid reads
 * the lot's clock from there rather than from the snapshot taken at the press:
 * the rival bid that caused a refusal can itself have extended the lot.
 */
export function useLotActions(lots: readonly LotSummary[]): LotActions {
  const { showToast } = useToast();
  const { submit } = useBidSubmit();
  const now = useNow();

  const [bidLot, setBidLot] = useState<LotSummary | null>(null);
  const [outcome, setOutcome] = useState<OneTapOutcome | null>(null);
  const [raiseLot, setRaiseLot] = useState<LotSummary | null>(null);
  const [inFlight, setInFlight] = useState<readonly string[]>([]);
  // A double tap must not become two bids even before the first response lands.
  const busy = useRef<Set<string>>(new Set());

  const place = useCallback(
    (lot: LotSummary, amountMinor: number, currency: string) => {
      if (busy.current.has(lot.id)) return;
      if (!isLotOpen(lot.status, lot.effective_ends_at, now)) {
        showToast({
          title: `Lot ${lot.lot_number} has closed`,
          description: "Its clock ran out, so nothing was bid.",
          tone: "danger",
        });
        return;
      }

      busy.current.add(lot.id);
      setInFlight((current) => [...current, lot.id]);

      void submit({
        lotId: lot.id,
        // Server-owned and price-banded, read from the lot or from the 422 that
        // refused the last press. Never computed.
        amountMinor,
        // No headroom: the backend treats an absent maximum as "the bid is the
        // maximum". A ceiling is what the sheet is for.
        maxAmountMinor: null,
        // Fresh on every press, re-bids included: a refusal wrote no row, and
        // the amount is different, so this is a new bid rather than a retry.
        clientRequestId: uuid(),
        isRaise: false,
      })
        .then((next) => {
          if (next.kind === "leading") {
            // A re-bid from the outcome sheet lands here too; winning closes it.
            setOutcome(null);
            showToast({
              title: `You're winning lot ${lot.lot_number}`,
              description: "Nothing more to do unless someone outbids you.",
              tone: "success",
            });
            return;
          }
          // Everything else earns the sheet: being outbid is where raising is
          // offered, and every refusal has something the user has to be told.
          // Replacing the state updates an open sheet in place — a second
          // refusal shows the newer minimum on the same button.
          setRaiseLot(lot);
          setOutcome({
            outcome: next,
            currency,
            lotId: lot.id,
            lotNumber: lot.lot_number,
            attemptedMinor: amountMinor,
          });
        })
        .finally(() => {
          busy.current.delete(lot.id);
          setInFlight((current) => current.filter((id) => id !== lot.id));
        });
    },
    [submit, showToast, now],
  );

  const bidNow = useCallback(
    (lot: LotSummary, currency: string) => place(lot, lot.minimum_next_bid_minor, currency),
    [place],
  );

  const openSheet = useCallback((lot: LotSummary) => setBidLot(lot), []);

  // The lot as the screen holds it now, falling back to the press's snapshot if
  // it has left the list — which only happens once it has ended.
  const outcomeLot = raiseLot ? (lots.find((lot) => lot.id === raiseLot.id) ?? raiseLot) : null;

  return {
    bidNow,
    openSheet,
    bidLot,
    closeBidSheet: () => setBidLot(null),
    outcome,
    clearOutcome: () => setOutcome(null),
    raiseFromOutcome: () => {
      setOutcome(null);
      if (outcomeLot) setBidLot(outcomeLot);
    },
    rebid: () => {
      if (outcomeLot && outcome?.outcome.kind === "too-low") {
        place(outcomeLot, outcome.outcome.minimumNextBidMinor, outcome.currency);
      }
    },
    rebidOpen:
      outcomeLot !== null && isLotOpen(outcomeLot.status, outcomeLot.effective_ends_at, now),
    rebidding: outcome !== null && inFlight.includes(outcome.lotId),
    isSubmitting: (lotId: string) => inFlight.includes(lotId),
  };
}

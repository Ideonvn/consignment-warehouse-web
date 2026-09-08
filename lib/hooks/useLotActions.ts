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
  /** Lot ids with a bid in flight, so a row can hold its button still. */
  isSubmitting: (lotId: string) => boolean;
};

/**
 * What the list's two buttons do.
 *
 * One path to `POST /bids` and one to the sheet, so the row cannot grow a second
 * opinion about what a press means — and that disagreement would be money.
 */
export function useLotActions(): LotActions {
  const { showToast } = useToast();
  const { submit } = useBidSubmit();
  const now = useNow();

  const [bidLot, setBidLot] = useState<LotSummary | null>(null);
  const [outcome, setOutcome] = useState<OneTapOutcome | null>(null);
  const [raiseLot, setRaiseLot] = useState<LotSummary | null>(null);
  const [inFlight, setInFlight] = useState<readonly string[]>([]);
  // A double tap must not become two bids even before the first response lands.
  const busy = useRef<Set<string>>(new Set());

  const bidNow = useCallback(
    (lot: LotSummary, currency: string) => {
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
        // Server-owned and price-banded, read from the lot. Never computed.
        amountMinor: lot.minimum_next_bid_minor,
        // No headroom: the backend treats an absent maximum as "the bid is the
        // maximum". A ceiling is what the sheet is for.
        maxAmountMinor: null,
        clientRequestId: uuid(),
        isRaise: false,
      })
        .then((next) => {
          if (next.kind === "leading") {
            showToast({
              title: `You're winning lot ${lot.lot_number}`,
              description: "Nothing more to do unless someone outbids you.",
              tone: "success",
            });
            return;
          }
          // Everything else earns the sheet: being outbid is where raising is
          // offered, and every refusal has something the user has to be told.
          setRaiseLot(lot);
          setOutcome({ outcome: next, currency, lotNumber: lot.lot_number });
        })
        .finally(() => {
          busy.current.delete(lot.id);
          setInFlight((current) => current.filter((id) => id !== lot.id));
        });
    },
    [submit, showToast, now],
  );

  const openSheet = useCallback((lot: LotSummary) => setBidLot(lot), []);

  return {
    bidNow,
    openSheet,
    bidLot,
    closeBidSheet: () => setBidLot(null),
    outcome,
    clearOutcome: () => setOutcome(null),
    raiseFromOutcome: () => {
      setOutcome(null);
      if (raiseLot) setBidLot(raiseLot);
    },
    isSubmitting: (lotId: string) => inFlight.includes(lotId),
  };
}

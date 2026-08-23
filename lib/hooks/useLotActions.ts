"use client";

import { useCallback, useRef, useState } from "react";
import type { AuctionBrowse } from "@/lib/hooks/useAuctionBrowse";
import { useMyBidStatus } from "@/lib/hooks/useMyBidStatus";
import { useNow } from "@/lib/hooks/useTicker";
import { isLotOpen } from "@/lib/format/time";
import {
  armPendingBid,
  cancelPendingBid,
  flushPendingBid,
  getPendingBid,
} from "@/lib/bid/pendingBid";
import { useToast } from "@/components/ui/Toast";
import type { LotCard, SwipeDirection } from "@/types/api";

export type DecideOptions = {
  /**
   * Whether an `interested` decision should place a bid.
   *
   * True only from the **card stack's** right swipe, its Bid button and its right
   * arrow — all the same gesture. The list passes nothing and keeps the sheet.
   * The flag is set at the call site rather than derived from which layout is
   * mounted, because it is the affordance that differs, not the screen.
   */
  commit?: boolean;
};

export type LotActions = {
  /**
   * Pass, or register interest.
   *
   * **In the list, interested is not a bid**: it records the swipe and opens the
   * sheet, where money moves only on confirm.
   *
   * **On the stack, a right swipe commits a bid** — after a five-second cancel
   * window during which nothing is sent. The gesture is the intent and the window
   * is the confirmation; a mis-swipe costs nothing because the request was never
   * made. It bids exactly the server's `minimum_next_bid_minor` with no headroom,
   * and only on a lot with no bid of the user's on it yet — anything else opens
   * the sheet, where the amount and the maximum live.
   */
  decide: (lot: LotCard, direction: SwipeDirection, options?: DecideOptions) => void;
  skip: (lot: LotCard) => void;
  undo: () => void;
  /** Opens the sheet directly — the raise offered after being outbid. */
  openSheet: (lot: LotCard) => void;
  /** The lot whose bid sheet is open, if any. */
  bidLot: LotCard | null;
  closeBidSheet: () => void;
  /** What the last action was, for a layout that wants to animate it out. */
  lastResolved: string | null;
};

/**
 * The behaviour that sits on top of the swipe mutations, shared by every layout.
 *
 * There is one `PUT /swipe` path and one cache writer, and this is the one place
 * that decides what a decision *means* on screen. A layout that reimplemented any
 * of it would eventually disagree with the stack about what a right swipe does,
 * and that disagreement is money.
 */
export function useLotActions(
  browse: AuctionBrowse,
  { biddingOpen, currency }: { biddingOpen: boolean; currency: string },
): LotActions {
  const { showToast } = useToast();
  const { statusFor } = useMyBidStatus();
  const now = useNow();
  const [bidLot, setBidLot] = useState<LotCard | null>(null);
  const [lastResolved, setLastResolved] = useState<string | null>(null);
  const busy = useRef(false);

  const decide = useCallback(
    (lot: LotCard, direction: SwipeDirection, options?: DecideOptions) => {
      if (busy.current) return;
      // A window is a grace period, not a queue: doing anything else deliberate
      // means the previous bid was meant, so it goes now.
      flushPendingBid();
      busy.current = true;
      setLastResolved(lot.id);

      if (direction === "interested") {
        if (!biddingOpen) {
          // Nothing to bid on yet. The interest is still saved.
          showToast({
            title: "Saved to Interested",
            description: "Bidding hasn't opened on this auction yet — we'll keep it for you.",
            tone: "neutral",
          });
        } else if (
          options?.commit &&
          // Gate on the clock, never on `status`: the worker's tick lags, and the
          // server would refuse the bid with a 409 five seconds from now.
          isLotOpen(lot.status, lot.effective_ends_at, now) &&
          // Only a first bid is one tap. With a bid already on the lot the sheet
          // is the right place, because raising is about a number. "Unknown" —
          // more bids than `/me/bids` will list — falls through to the sheet too:
          // when we cannot tell, we do not bid automatically.
          statusFor(lot.id) === "none"
        ) {
          armPendingBid({
            auctionId: lot.auction_id,
            lot,
            currency,
            // Server-owned, price-banded, read from the lot. Never computed.
            amountMinor: lot.minimum_next_bid_minor,
          });
        } else {
          setBidLot(lot);
        }
      }

      void browse.decide(lot, direction).finally(() => {
        busy.current = false;
      });
    },
    [browse, biddingOpen, currency, showToast, statusFor, now],
  );

  const skip = useCallback(
    (lot: LotCard) => {
      if (busy.current) return;
      flushPendingBid();
      setLastResolved(lot.id);
      browse.skip(lot);
    },
    [browse],
  );

  const undo = useCallback(() => {
    /*
     * Three states, one control.
     *
     * A window still running is cancelled *and* its swipe undone — one gesture,
     * one obvious meaning, and no request was ever made. A cancelled or
     * never-committed swipe undoes as it always has. A swipe whose bid already
     * went out undoes the swipe only: the bid stands, because nothing in this app
     * can retract one, and the toast says so rather than letting the user believe
     * their money came back.
     */
    const cancelled = cancelPendingBid();

    void browse.undo().then((result) => {
      if (cancelled) {
        showToast({
          title: `Lot ${cancelled.lot.lot_number} is back`,
          description: "That bid was never sent.",
          tone: "neutral",
        });
        return;
      }
      if (!result) return;
      showToast({
        title: result.lot ? `Lot ${result.lot.lot_number} is back` : "Undone",
        description: result.bidPlaced
          ? "Your bid still stands — a placed bid can't be taken back."
          : undefined,
        tone: "neutral",
      });
    });
  }, [browse, showToast]);

  const openSheet = useCallback((lot: LotCard) => {
    flushPendingBid();
    setBidLot(lot);
  }, []);

  return {
    decide,
    skip,
    undo,
    openSheet,
    bidLot,
    closeBidSheet: () => {
      // Opening or closing the sheet is deliberate; anything waiting was meant.
      if (getPendingBid()) flushPendingBid();
      setBidLot(null);
    },
    lastResolved,
  };
}

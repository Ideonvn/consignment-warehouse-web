"use client";

import { useCallback, useRef, useState } from "react";
import type { AuctionBrowse } from "@/lib/hooks/useAuctionBrowse";
import { useToast } from "@/components/ui/Toast";
import type { LotCard, SwipeDirection } from "@/types/api";

export type LotActions = {
  /**
   * Pass, or register interest. **Interested is not a bid** — it records the
   * swipe and asks for the bid sheet; money moves only when the user confirms
   * there. A button in the list means exactly what a right swipe means.
   */
  decide: (lot: LotCard, direction: SwipeDirection) => void;
  skip: (lot: LotCard) => void;
  undo: () => void;
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
 * that decides what a decision *means* on screen: which ones open the bid sheet,
 * what is said when bidding has not opened yet, and that a second tap while the
 * first is in flight does nothing. A layout that reimplemented any of this would
 * eventually disagree with the stack about what a right-swipe does, and that
 * disagreement is money.
 */
export function useLotActions(
  browse: AuctionBrowse,
  { biddingOpen }: { biddingOpen: boolean },
): LotActions {
  const { showToast } = useToast();
  const [bidLot, setBidLot] = useState<LotCard | null>(null);
  const [lastResolved, setLastResolved] = useState<string | null>(null);
  const busy = useRef(false);

  const decide = useCallback(
    (lot: LotCard, direction: SwipeDirection) => {
      if (busy.current) return;
      busy.current = true;
      setLastResolved(lot.id);

      // A swipe right records intent; only the sheet takes money. Before the
      // auction opens there is no sheet to show — the interest is still saved.
      if (direction === "interested") {
        if (biddingOpen) {
          setBidLot(lot);
        } else {
          showToast({
            title: "Saved to Interested",
            description: "Bidding hasn't opened on this auction yet — we'll keep it for you.",
            tone: "neutral",
          });
        }
      }

      void browse.decide(lot, direction).finally(() => {
        busy.current = false;
      });
    },
    [browse, biddingOpen, showToast],
  );

  const skip = useCallback(
    (lot: LotCard) => {
      if (busy.current) return;
      setLastResolved(lot.id);
      browse.skip(lot);
    },
    [browse],
  );

  const undo = useCallback(() => {
    void browse.undo().then((restored) => {
      // `restored` is null when the lot was not in the pages currently loaded —
      // it is on its way back from the refetch, so say so rather than nothing.
      showToast({
        title: restored ? `Lot ${restored.lot_number} is back` : "Undone",
        tone: "neutral",
      });
    });
  }, [browse, showToast]);

  return {
    decide,
    skip,
    undo,
    bidLot,
    closeBidSheet: () => setBidLot(null),
    lastResolved,
  };
}

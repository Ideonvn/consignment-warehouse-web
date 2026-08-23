"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { deleteSwipe } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import { serverNow } from "@/lib/format/clock";
import { useBrowseSession } from "@/lib/browse/browseSession";
import {
  cancelPendingBid,
  registerPendingBidCommit,
  takePendingBid,
  usePendingBid,
  type PendingBid,
} from "@/lib/bid/pendingBid";
import { useBidSubmit } from "@/lib/hooks/useBidSubmit";
import { BidOutcomeSheet, type OneTapOutcome } from "@/components/bid/BidOutcomeSheet";
import { useToast } from "@/components/ui/Toast";
import type { LotSummary } from "@/types/api";

/**
 * Owns everything effectful about the cancel window: the timer, the tab-visibility
 * rule, the request, and what happens to the swipe afterwards. The store next door
 * owns only the state, so a plain function can arm or flush a bid from anywhere
 * without this component being in scope.
 *
 * Mounted once, by the auction screen.
 */
export function PendingBidRunner({
  onRaise,
}: {
  /** Opens the bid sheet on a lot, for the raise offered after being outbid. */
  onRaise: (lot: LotSummary) => void;
}) {
  const pending = usePendingBid();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { submit } = useBidSubmit();
  const dropDecision = useBrowseSession((state) => state.dropDecision);
  const markBidPlaced = useBrowseSession((state) => state.markBidPlaced);

  const [outcomeState, setOutcomeState] = useState<OneTapOutcome | null>(null);
  const [raiseLot, setRaiseLot] = useState<LotSummary | null>(null);

  /**
   * Put the lot back.
   *
   * A refusal means no bid exists, so the swipe that was recorded ahead of it
   * should not either — the lot returns to the stack to be acted on once the
   * reason is fixed. Targeted by lot id rather than "undo the newest", because
   * five seconds is long enough for the user to have swiped two more cards, and
   * undoing one of those instead would be its own bug.
   */
  const rollbackSwipe = useCallback(
    async (bid: PendingBid) => {
      dropDecision(bid.auctionId, bid.lot.id);
      try {
        await deleteSwipe(bid.lot.id);
      } catch {
        // The swipe outliving a refused bid is untidy but harmless: it sits in My
        // bids as interested, which is exactly where a dismissed sheet leaves it.
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.lots(bid.auctionId) });
    },
    [dropDecision, queryClient],
  );

  const commit = useCallback(
    async (bid: PendingBid) => {
      const outcome = await submit({
        lotId: bid.lot.id,
        // The server's own figure, carried from the lot. A one-tap bid takes no
        // headroom: omitting the maximum makes the backend's effective maximum
        // the bid itself. Raising is offered later, on being outbid.
        amountMinor: bid.amountMinor,
        maxAmountMinor: null,
        clientRequestId: bid.clientRequestId,
        isRaise: false,
      });

      if (outcome.kind === "leading" || outcome.kind === "outbid") {
        // Undo can still take the swipe back, but it cannot unmake this — there is
        // no retraction API — so the history remembers, and says so.
        markBidPlaced(bid.auctionId, bid.lot.id);
      } else {
        await rollbackSwipe(bid);
      }

      if (outcome.kind === "leading") {
        showToast({
          title: `You're winning lot ${bid.lot.lot_number}`,
          description: "Nothing more to do unless someone outbids you.",
          tone: "success",
        });
        return;
      }

      // Everything else earns the sheet: being outbid is where raising is offered,
      // and every refusal has something the user has to be told.
      setRaiseLot(bid.lot);
      setOutcomeState({ outcome, currency: bid.currency, lotNumber: bid.lot.lot_number });
    },
    [submit, markBidPlaced, rollbackSwipe, showToast],
  );

  // `armPendingBid` flushes whatever is already waiting, which needs this.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  useEffect(() => registerPendingBidCommit((bid) => void commitRef.current(bid)), []);

  // The window itself. A real timer, not the 1s ticker: the bid fires at five
  // seconds regardless of where the shared tick happens to fall.
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      // Take it out of the slot first: committing while it is still there leaves
      // the countdown on screen for a bid that has already gone, and the next
      // deliberate action would flush the same bid again.
      const due = takePendingBid();
      if (due) void commitRef.current(due);
    }, Math.max(0, pending.dueAt - serverNow()));
    return () => clearTimeout(timer);
  }, [pending]);

  /*
   * Hiding the tab cancels; it does not commit.
   *
   * Backgrounding is rarely a decision — a phone call, a notification, the screen
   * locking — and letting an event the user did not choose turn a cancellable
   * window into an unretractable bid removes the safety property exactly when it
   * is doing its job. The asymmetry decides it: cancelling costs immediacy, and
   * the swipe is still recorded so the lot is in My bids; committing costs money
   * that cannot be given back.
   *
   * The window is not resumed on return, either. A bid firing minutes later at a
   * price that has moved is worse than both alternatives.
   */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      const cancelled = cancelPendingBid();
      if (!cancelled) return;
      showToast({
        title: `Lot ${cancelled.lot.lot_number}: bid not placed`,
        description: "You left before it sent. It's saved in My bids — you can bid there.",
        tone: "neutral",
      });
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [showToast]);

  return (
    <BidOutcomeSheet
      state={outcomeState}
      onClose={() => setOutcomeState(null)}
      onRaise={() => {
        setOutcomeState(null);
        if (raiseLot) onRaise(raiseLot);
      }}
    />
  );
}

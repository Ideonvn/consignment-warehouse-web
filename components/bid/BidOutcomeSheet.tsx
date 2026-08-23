"use client";

import type { BidOutcome } from "@/lib/hooks/useBidSubmit";
import { formatMoney } from "@/lib/format/money";
import { BidResultPanel, ShortfallPanel } from "@/components/bid/BidOutcomePanels";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

export type OneTapOutcome = { outcome: BidOutcome; currency: string; lotNumber: number };

/**
 * What a one-tap bid landed on.
 *
 * The sheet does the talking because by the time the request is made the card has
 * been gone for five seconds — there is nothing to spring back. A refused bid
 * un-records its swipe and puts the lot back in the stack, so this explains what
 * happened and the lot is there to act on again.
 */
export function BidOutcomeSheet({
  state,
  onClose,
  onRaise,
}: {
  state: OneTapOutcome | null;
  onClose: () => void;
  /** Raising is offered here, at the moment being outbid makes its value obvious. */
  onRaise: () => void;
}) {
  return (
    <Sheet open={state !== null} onClose={onClose} title="Your bid" hideTitle>
      {state ? <Body state={state} onClose={onClose} onRaise={onRaise} /> : null}
    </Sheet>
  );
}

function Body({
  state,
  onClose,
  onRaise,
}: {
  state: OneTapOutcome;
  onClose: () => void;
  onRaise: () => void;
}) {
  const { outcome, currency, lotNumber } = state;

  if (outcome.kind === "leading" || outcome.kind === "outbid") {
    return (
      <BidResultPanel outcome={outcome} currency={currency} onClose={onClose} onRaise={onRaise} />
    );
  }

  if (outcome.kind === "insufficient-credit") {
    return <ShortfallPanel outcome={outcome} onClose={onClose} />;
  }

  const copy =
    outcome.kind === "closed"
      ? {
          title: "That lot closed",
          body: "Its clock ran out before the bid went in, so nothing was placed and nothing was charged.",
        }
      : outcome.kind === "too-low"
        ? {
            title: "Someone bid first",
            // Straight from the server's 422 — never computed here.
            body: `The minimum is now ${formatMoney(outcome.minimumNextBidMinor, currency)}. Lot ${lotNumber} is back in your stack if you still want it.`,
          }
        : {
            title: "That bid didn't go through",
            // The server's message is a fragment ("too many bids on this lot"),
            // so it needs its own full stop before the wait is appended.
            body:
              outcome.message.replace(/[.!?]?$/, ".") +
              (outcome.retryAfter
                ? ` Try again in ${outcome.retryAfter < 90 ? `${outcome.retryAfter}s` : `${Math.ceil(outcome.retryAfter / 60)} min`}.`
                : ""),
          };

  return (
    <div className="px-5 pt-2 pb-6">
      <p className="text-lg font-semibold text-danger">{copy.title}</p>
      <p className="mt-2 text-sm text-text-muted">{copy.body}</p>
      <Button fullWidth size="lg" className="mt-6" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

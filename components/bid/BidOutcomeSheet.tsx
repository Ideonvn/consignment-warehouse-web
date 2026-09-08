"use client";

import type { BidOutcome } from "@/lib/hooks/useBidSubmit";
import { formatMoney } from "@/lib/format/money";
import { BidResultPanel, ShortfallPanel } from "@/components/bid/BidOutcomePanels";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

export type OneTapOutcome = { outcome: BidOutcome; currency: string; lotNumber: number };

/**
 * What a one-press bid landed on.
 *
 * The bid button places the bid immediately — no sheet in front of it and no
 * cancel window behind it — so this is the only thing that can explain a
 * refusal, and it has nowhere to hide. The lot never leaves the list, so
 * whatever went wrong can be acted on again straight away.
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
          // Not necessarily the clock: a 409 is also a lot withdrawn or
          // cancelled out from under a page that still shows it live. Say what
          // is certain — no bid, no charge — rather than guessing the cause.
          body: "It stopped accepting bids before this one went in, so nothing was placed and nothing was charged.",
        }
      : outcome.kind === "too-low"
        ? {
            title: "Someone bid first",
            // Straight from the server's 422 — never computed here.
            body: `The minimum is now ${formatMoney(outcome.minimumNextBidMinor, currency)}. Lot ${lotNumber} is still in the list if you want it at that price.`,
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

"use client";

import { useEffect, useState } from "react";
import type { BidOutcome } from "@/lib/hooks/useBidSubmit";
import { formatMoney } from "@/lib/format/money";
import { BidResultPanel, ShortfallPanel } from "@/components/bid/BidOutcomePanels";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { Sheet } from "@/components/ui/Sheet";

export type OneTapOutcome = {
  outcome: BidOutcome;
  currency: string;
  lotId: string;
  lotNumber: number;
  /** What the press tried to bid, so a refusal can name the figure that did not go in. */
  attemptedMinor: number;
};

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
  onBidAgain,
  bidAgainOpen,
  bidAgainBusy,
}: {
  state: OneTapOutcome | null;
  onClose: () => void;
  /** Raising is offered here, at the moment being outbid makes its value obvious. */
  onRaise: () => void;
  /** Bids the minimum a too-low refusal named, through the row's own path. */
  onBidAgain: () => void;
  /** The lot is still open on the clock. */
  bidAgainOpen: boolean;
  /** That re-bid is in flight. */
  bidAgainBusy: boolean;
}) {
  return (
    <Sheet open={state !== null} onClose={onClose} title="Your bid" hideTitle>
      {state ? (
        <Body
          state={state}
          onClose={onClose}
          onRaise={onRaise}
          onBidAgain={onBidAgain}
          bidAgainOpen={bidAgainOpen}
          bidAgainBusy={bidAgainBusy}
        />
      ) : null}
    </Sheet>
  );
}

function Body({
  state,
  onClose,
  onRaise,
  onBidAgain,
  bidAgainOpen,
  bidAgainBusy,
}: {
  state: OneTapOutcome;
  onClose: () => void;
  onRaise: () => void;
  onBidAgain: () => void;
  bidAgainOpen: boolean;
  bidAgainBusy: boolean;
}) {
  const { outcome, currency, lotNumber, attemptedMinor } = state;

  if (outcome.kind === "leading" || outcome.kind === "outbid") {
    return (
      <BidResultPanel outcome={outcome} currency={currency} onClose={onClose} onRaise={onRaise} />
    );
  }

  if (outcome.kind === "insufficient-credit") {
    return <ShortfallPanel outcome={outcome} onClose={onClose} />;
  }

  if (outcome.kind === "too-low") {
    return (
      <TooLowPanel
        minimum={outcome.minimumNextBidMinor}
        attemptedMinor={attemptedMinor}
        currency={currency}
        lotNumber={lotNumber}
        onClose={onClose}
        onBidAgain={onBidAgain}
        bidAgainOpen={bidAgainOpen}
        bidAgainBusy={bidAgainBusy}
      />
    );
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

/**
 * How long the re-bid button ignores presses after its figure changes.
 *
 * Measured, not guessed: a double tap 191ms apart on a contested lot sent the
 * first press, took a 422 back in 21ms, and the second tap landed on the button
 * already re-armed with the new, higher figure — a bid at an amount shown for
 * ~170ms. The second tap of a double tap arrives inside the platform's
 * double-tap timeout (Android 300ms, iOS ~350ms) of the first, and the figure can
 * only change after it, so 500ms covers it; nobody reads a new amount and
 * deliberately presses in less. It holds on first appearance too, which covers a
 * double tap on the row that opened this sheet.
 */
const NEW_FIGURE_HOLD_MS = 500;

function TooLowPanel({
  minimum,
  attemptedMinor,
  currency,
  lotNumber,
  onClose,
  onBidAgain,
  bidAgainOpen,
  bidAgainBusy,
}: {
  /** Straight from the server's 422 — never computed here. */
  minimum: number;
  attemptedMinor: number;
  currency: string;
  lotNumber: number;
  onClose: () => void;
  onBidAgain: () => void;
  bidAgainOpen: boolean;
  bidAgainBusy: boolean;
}) {
  // The figure the button has shown long enough to be pressed on purpose.
  const [settledMinor, setSettledMinor] = useState<number | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettledMinor(minimum), NEW_FIGURE_HOLD_MS);
    return () => clearTimeout(timer);
  }, [minimum]);

  return (
    <div className="px-5 pt-2 pb-6">
      {/* Not an error, so not in danger red: another bid landing a moment
          earlier is the most ordinary event on a contested lot. */}
      <p className="text-lg font-semibold">Another bidder got in just before you</p>
      <p className="mt-2 text-sm text-text-muted">
        Your bid of <Money minor={attemptedMinor} currency={currency} className="text-text" /> was
        not placed, and nothing was charged.{" "}
        {bidAgainOpen ? (
          <>
            The lowest bid on lot {lotNumber} is now{" "}
            <Money minor={minimum} currency={currency} className="text-text" />.
          </>
        ) : (
          <>Lot {lotNumber} has now closed.</>
        )}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        {/*
         * One tap, never automatic. Pressing places this bid with no
         * confirmation, exactly like the row's button — so the figure is on the
         * button before the press, and it is the server's own. If this press is
         * refused too, the sheet updates in place with the next one.
         */}
        <Button
          size="lg"
          fullWidth
          disabled={!bidAgainOpen || settledMinor !== minimum}
          loading={bidAgainBusy}
          onClick={onBidAgain}
          aria-label={`Bid ${formatMoney(minimum, currency)} on lot ${lotNumber}`}
        >
          <span>
            BID <Money minor={minimum} currency={currency} />
          </span>
        </Button>
        <Button variant="secondary" size="lg" fullWidth onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

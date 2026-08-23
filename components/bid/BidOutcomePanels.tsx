"use client";

import Link from "next/link";
import type { BidOutcome } from "@/lib/hooks/useBidSubmit";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { Money } from "@/components/ui/Money";
import { PaymentDetails } from "@/components/account/PaymentDetails";
import { cn } from "@/lib/utils/cn";

/*
 * What a placed bid can land on, lifted out of `BidSheet` so the one-tap path
 * shows the same panels instead of a second copy of them. The shortfall figures
 * especially: `shortfall_minor` is server-computed and is never
 * `required - balance`, so there must be exactly one place that renders it.
 */

export /**
 * The refusal. It has to say what they have, what this auction needs and what to
 * add — "you are not eligible" tells someone nothing they can act on.
 */
function ShortfallPanel({
  outcome,
  onClose,
}: {
  outcome: Extract<BidOutcome, { kind: "insufficient-credit" }>;
  onClose: () => void;
}) {
  const currency = outcome.currencyCode;
  const owes = outcome.balanceMinor < 0;

  return (
    <div className="px-5 pt-2 pb-6">
      <p className="text-xl font-semibold">A deposit is needed to bid here</p>

      <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-border bg-surface-raised p-4 text-sm">
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-text-muted">You have</span>
          <span className={cn("font-semibold", owes ? "text-danger" : "text-text")}>
            <Money minor={Math.abs(outcome.balanceMinor)} currency={currency} />
            {owes ? " due" : " on account"}
          </span>
        </p>
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-text-muted">This auction needs</span>
          <span className="font-semibold text-text">
            <Money minor={outcome.requiredMinor} currency={currency} />
          </span>
        </p>
        <p className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-3">
          <span className="font-medium">Add</span>
          {/* Server-computed: someone who owes needs the debt cleared as well as
              the deposit, so this is never `required - balance`. */}
          <span className="text-lg font-semibold text-accent-text">
            <Money minor={outcome.shortfallMinor} currency={currency} />
          </span>
        </p>
      </div>

      <PaymentDetails className="mt-3" />

      <div className="mt-6 flex flex-col gap-2">
        <Link
          href="/account"
          className="inline-flex min-h-14 w-full items-center justify-center rounded-full border border-accent-edge bg-accent px-5 font-semibold text-accent-ink"
        >
          See my account
        </Link>
        <Button variant="secondary" size="lg" fullWidth onClick={onClose}>
          Not now
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-text-muted">
        Nothing was bid. You can keep browsing and swiping in the meantime.
      </p>
    </div>
  );
}

export function BidResultPanel({
  outcome,
  currency,
  onClose,
  onRaise,
}: {
  outcome: Extract<BidOutcome, { kind: "leading" | "outbid" }>;
  currency: string;
  onClose: () => void;
  onRaise: () => void;
}) {
  const { result } = outcome;
  const leading = outcome.kind === "leading";

  return (
    <div className="px-5 pt-2 pb-6">
      <p className={cn("text-xl font-semibold", leading ? "text-success" : "text-danger")}>
        {leading ? (
          <>
            You&apos;re winning at{" "}
            <Money minor={result.current_bid_minor ?? 0} currency={currency} />
          </>
        ) : (
          "Outbid — someone's maximum is higher"
        )}
      </p>

      <p className="mt-2 text-sm text-text-muted">
        {leading ? (
          <>
            We&apos;ll keep bidding for you up to{" "}
            <Money
              minor={result.my_max_minor ?? 0}
              currency={currency}
              className="text-text"
            />
            . You only pay what it takes to stay ahead.
          </>
        ) : (
          <>
            Your bid was accepted, but the lot is now at{" "}
            <Money minor={result.current_bid_minor ?? 0} currency={currency} className="text-text" />
            . Raise your maximum to get back in front.
          </>
        )}
      </p>

      {result.extended ? (
        <p className="mt-3 text-xs text-text-muted">
          A late bid extended this lot — it now closes{" "}
          <Countdown endsAt={result.effective_ends_at} prefix="in" className="text-text" />.
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-2">
        {leading ? null : (
          <Button size="lg" fullWidth onClick={onRaise}>
            Raise my maximum
          </Button>
        )}
        <Button variant={leading ? "primary" : "secondary"} size="lg" fullWidth onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

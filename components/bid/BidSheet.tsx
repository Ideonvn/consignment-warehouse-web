"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLot } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  currencySymbol,
  formatMoney,
  parseMoneyInput,
  toMajorInputValue,
} from "@/lib/format/money";
import { useBidSubmit, type BidOutcome } from "@/lib/hooks/useBidSubmit";
import { useNow } from "@/lib/hooks/useTicker";
import { hasEnded } from "@/lib/format/time";
import type { LotCard } from "@/types/api";

/**
 * Everything the sheet needs to render before it fetches the lot itself, so a
 * card, a lot detail or a "my bids" row can all open it.
 */
export type BidTarget = Pick<
  LotCard,
  | "id"
  | "title"
  | "primary_image_url"
  | "current_bid_minor"
  | "minimum_next_bid_minor"
  | "starting_price_minor"
  | "bid_count"
  | "effective_ends_at"
>;
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { LotImage } from "@/components/ui/LotImage";
import { Money } from "@/components/ui/Money";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/utils/cn";

/**
 * One number: the most you are willing to pay.
 *
 * The backend stores every bid as a proxy ceiling, so hiding that mechanic
 * produces users who feel tricked when the price climbs on its own. The sheet
 * states it plainly and recomputes the live consequence as they type.
 */
export function BidSheet({
  lot,
  currency,
  open,
  onClose,
}: {
  lot: BidTarget | null;
  currency: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open && lot !== null} onClose={onClose} title="Place your maximum" hideTitle>
      {lot ? <BidSheetBody lot={lot} currency={currency} onClose={onClose} /> : null}
    </Sheet>
  );
}

function BidSheetBody({
  lot,
  currency,
  onClose,
}: {
  lot: BidTarget;
  currency: string;
  onClose: () => void;
}) {
  // The lot list doesn't carry the user's own ceiling; the detail call does.
  const { data: detail } = useQuery({
    queryKey: queryKeys.lot(lot.id),
    queryFn: () => getLot(lot.id),
    staleTime: 5_000,
  });

  const existingMax = detail?.my_auto_bid_max_minor ?? null;
  const currentBid = detail?.current_bid_minor ?? lot.current_bid_minor;
  const bidCount = detail?.bid_count ?? lot.bid_count;
  const endsAt = detail?.effective_ends_at ?? lot.effective_ends_at;

  // The minimum is whatever the freshest source says — the card, the detail
  // fetch, or a 422 telling us someone got in first.
  const [minimumFromServer, setMinimumFromServer] = useState(0);
  const minimum = Math.max(
    lot.minimum_next_bid_minor,
    detail?.minimum_next_bid_minor ?? 0,
    minimumFromServer,
  );

  // Null until they type: the field then tracks the minimum as it moves.
  const [typed, setTyped] = useState<string | null>(null);
  const value = typed ?? toMajorInputValue(minimum);
  const [outcome, setOutcome] = useState<BidOutcome | null>(null);
  // One id per bid intent. A double tap or a network retry reuses it and the
  // backend returns the original result instead of bidding twice.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  const { submit, inFlight } = useBidSubmit();

  // The clock can run out while the sheet is open; the server would 409, and
  // offering a confirm button we know is dead would be worse than saying so.
  const now = useNow();
  const closed = outcome?.kind === "closed" || hasEnded(endsAt, now ?? 0);

  const amountMinor = parseMoneyInput(value);

  // Increment chips follow the server's own step, whatever band the price is in.
  const step = useMemo(() => {
    const gap = minimum - (currentBid ?? lot.starting_price_minor);
    return gap > 0 ? gap : Math.max(10_000, Math.round(minimum * 0.05));
  }, [minimum, currentBid, lot.starting_price_minor]);

  const validationError = useMemo(() => {
    if (amountMinor === null) return null;
    if (existingMax !== null && amountMinor <= existingMax) {
      return `Maximums can only go up. Enter more than ${formatMoney(existingMax, currency)}.`;
    }
    if (amountMinor < minimum) {
      return `The minimum right now is ${formatMoney(minimum, currency)}.`;
    }
    return null;
  }, [amountMinor, existingMax, minimum, currency]);

  const canSubmit = amountMinor !== null && validationError === null && !inFlight;
  // What they'd actually pay right now: the visible step, capped by their max.
  const payNow = amountMinor === null ? minimum : Math.min(minimum, amountMinor);

  async function confirm() {
    if (!canSubmit || amountMinor === null) return;

    const next = await submit({
      lotId: lot.id,
      amountMinor: minimum,
      maxAmountMinor: amountMinor,
      clientRequestId: requestId,
      isRaise: existingMax !== null,
    });

    setOutcome(next);
    if (next.kind === "too-low") {
      // Same intent, same request id: a retry must stay idempotent.
      setMinimumFromServer(next.minimumNextBidMinor);
      setTyped(null);
    }
  }

  function startNewBid(fromMinor: number) {
    setOutcome(null);
    setMinimumFromServer(fromMinor);
    setTyped(null);
    // A genuinely new intent, so it gets a genuinely new idempotency key.
    setRequestId(crypto.randomUUID());
  }

  if (outcome?.kind === "leading" || outcome?.kind === "outbid") {
    return (
      <BidResultPanel
        outcome={outcome}
        currency={currency}
        onClose={onClose}
        onRaise={() => startNewBid(outcome.result.minimum_next_bid_minor)}
      />
    );
  }

  if (closed) {
    return (
      <div className="px-5 pt-2 pb-6 text-center">
        <p className="text-lg font-semibold text-danger">Bidding closed on this lot</p>
        <p className="mt-2 text-sm text-text-muted">
          This lot&apos;s clock has run out, so no further bids can be placed.
          Nothing was charged.
        </p>
        <Button fullWidth size="lg" className="mt-6" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-1 pb-6">
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
          <LotImage src={lot.primary_image_url} alt={lot.title} sizes="64px" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{lot.title}</p>
          <p className="mt-0.5 text-sm text-text-muted">
            {currentBid !== null && bidCount > 0 ? (
              <>
                Current bid <Money minor={currentBid} currency={currency} className="text-text" />
              </>
            ) : (
              <>
                Starting at{" "}
                <Money minor={lot.starting_price_minor} currency={currency} className="text-text" />{" "}
                · no bids yet
              </>
            )}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            <Countdown endsAt={endsAt} prefix="Closes in" />
          </p>
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="bid-max" className="block text-sm font-medium text-text-muted">
          Your maximum
        </label>
        <div
          className={cn(
            "mt-2 flex items-center gap-2 rounded-2xl border bg-surface-raised px-4",
            validationError ? "border-danger/60" : "border-border focus-within:border-accent/60",
          )}
        >
          <span className="text-2xl text-text-muted">{currencySymbol(currency)}</span>
          <input
            id="bid-max"
            value={value}
            onChange={(event) => setTyped(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            aria-describedby="bid-explainer"
            aria-invalid={validationError ? true : undefined}
            className="tabular min-h-16 w-full bg-transparent text-3xl font-semibold outline-none"
          />
        </div>

        <div className="mt-3 flex gap-2">
          {[1, 2, 5].map((multiple) => {
            const target = (amountMinor ?? minimum) + step * multiple;
            return (
              <button
                key={multiple}
                type="button"
                onClick={() => setTyped(toMajorInputValue(target))}
                className="tabular min-h-11 flex-1 rounded-full border border-border bg-surface-raised text-sm font-medium hover:border-accent/50"
              >
                +{formatMoney(step * multiple, currency)}
              </button>
            );
          })}
        </div>

        {validationError ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {validationError}
          </p>
        ) : null}
        {outcome?.kind === "too-low" ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            Someone bid just before you. The minimum is now{" "}
            {formatMoney(minimum, currency)}.
          </p>
        ) : null}
        {outcome?.kind === "error" ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {outcome.message}
            {outcome.retryAfter ? ` Try again in ${outcome.retryAfter}s.` : ""}
          </p>
        ) : null}
      </div>

      <div id="bid-explainer" className="mt-5 rounded-2xl border border-border bg-surface-raised p-4">
        <p className="text-sm font-semibold">
          You&apos;ll pay only what it takes to win, up to{" "}
          <Money minor={amountMinor ?? minimum} currency={currency} />.
        </p>
        <p className="mt-1 text-sm text-text-muted">
          We bid for you automatically. Right now that means{" "}
          <Money minor={payNow} currency={currency} className="text-text" />.
        </p>
        {existingMax !== null ? (
          <p className="mt-2 text-xs text-text-muted">
            Your current maximum is <Money minor={existingMax} currency={currency} />. Maximums can
            only be raised, never lowered.
          </p>
        ) : null}
      </div>

      <Button
        size="lg"
        fullWidth
        className="mt-5"
        loading={inFlight}
        disabled={!canSubmit}
        onClick={confirm}
      >
        Confirm — up to {formatMoney(amountMinor ?? minimum, currency)}
      </Button>

      <button
        type="button"
        onClick={onClose}
        className="mt-2 min-h-11 w-full text-sm text-text-muted hover:text-text"
      >
        Not now
      </button>
    </div>
  );
}

function BidResultPanel({
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

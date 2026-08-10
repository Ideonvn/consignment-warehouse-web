"use client";

import { Countdown } from "@/components/ui/Countdown";
import { LotImage } from "@/components/ui/LotImage";
import { Money } from "@/components/ui/Money";
import { StatusPill } from "@/components/ui/StatusPill";
import { usePricePulse } from "@/lib/realtime/store";
import { useNow } from "@/lib/hooks/useTicker";
import { isLotOpen } from "@/lib/format/time";
import { lotOutcome } from "@/lib/format/lotStatus";
import type { LotCard } from "@/types/api";
import { cn } from "@/lib/utils/cn";

/** The visible face of a lot: photo first, price loudest. */
export function LotCardFace({
  lot,
  currency,
  priority = false,
  className,
}: {
  lot: LotCard;
  currency: string;
  priority?: boolean;
  className?: string;
}) {
  const hasBids = lot.current_bid_minor !== null && lot.bid_count > 0;
  // Changing the key restarts the flash, which is how someone watching the
  // screen notices the price moved under them.
  const pulse = usePricePulse(lot.id);
  const now = useNow();
  const open = isLotOpen(lot.status, lot.effective_ends_at, now);
  const outcome = lotOutcome(lot.status, {
    clockExpired: !open,
    hasBids: lot.bid_count > 0,
  });

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden rounded-card border border-border bg-surface",
        className,
      )}
    >
      <div className="relative min-h-0 flex-1">
        <LotImage src={lot.primary_image_url} alt={lot.title} priority={priority} />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-surface via-surface/80 to-transparent" />

        <div className="absolute top-3 right-3 left-3 flex items-start justify-between gap-2">
          <StatusPill>Lot {lot.lot_number}</StatusPill>
          {outcome ? (
            <StatusPill tone={outcome.tone}>{outcome.label}</StatusPill>
          ) : (
            <StatusPill tone={hasBids ? "live" : "muted"} pulse={hasBids}>
              <Countdown endsAt={lot.effective_ends_at} />
            </StatusPill>
          )}
        </div>
      </div>

      <div className="relative p-5 pt-0">
        <h2 className="text-xl leading-tight font-semibold">{lot.title}</h2>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-text-muted uppercase">
              {hasBids ? "Current bid" : "Starting at"}
            </p>
            <p
              key={pulse}
              className={cn(
                "text-3xl font-semibold text-accent-text",
                pulse > 0 && "animate-pulse-accent",
              )}
            >
              <Money
                minor={hasBids ? (lot.current_bid_minor ?? 0) : lot.starting_price_minor}
                currency={currency}
              />
            </p>
          </div>
          <p className="pb-1 text-sm text-text-muted">
            {lot.bid_count === 0
              ? "No bids yet"
              : `${lot.bid_count} bid${lot.bid_count === 1 ? "" : "s"}`}
          </p>
        </div>

        {hasBids && !lot.reserve_met ? (
          <p className="mt-2 text-xs text-text-muted">
            <span aria-hidden>· </span>Reserve not met
          </p>
        ) : null}
      </div>
    </div>
  );
}

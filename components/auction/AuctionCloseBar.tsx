"use client";

import { useNow } from "@/lib/hooks/useTicker";
import { formatCloseDay, formatDuration, isLotOpen, msUntil } from "@/lib/format/time";
import { Countdown } from "@/components/ui/Countdown";
import type { Auction, LotSummary } from "@/types/api";

/** Where the quiet line becomes a pinned alarm. Matches the clock's own tiers. */
const FINAL_HOUR_MS = 60 * 60 * 1000;

/**
 * The auction header's clock line, quiet until it isn't.
 *
 * **It says "next lot closes", never "auction closes", and that is about our
 * data model rather than about wording.** Anti-snipe is per lot: extending the
 * auction's own `ends_at` would let one contested lot hold the whole sale open,
 * so every lot's `effective_ends_at` moves independently. All lots share a base
 * close until the first extension fires — after that an auction-level countdown
 * is simply wrong, so this is derived from the *minimum* `effective_ends_at`
 * among the lots still open.
 *
 * Above the final hour it is one static line and nothing is pinned. An alarm
 * that runs for six days is the same crying wolf that `plain` exists to
 * prevent; an alarm on the last hour of a lot someone can still bid on is not,
 * which is why this is the one auction-level clock that does not pass `plain`.
 *
 * Only the loaded pages are considered. Every lot shares a base close until an
 * extension moves one, so page one holds the earliest in practice; the list
 * pages in on scroll and this narrows with it.
 *
 * **The bar can never contradict the auction badge.** Lots close on a stagger
 * that runs *past* the auction's own `ends_at` — the seed ships
 * `midweek-closing-soon` ending at 20:02 with its last lot at 22:15 — so from
 * the moment the worker marks the auction `ended` there are still lots reading
 * `live` with future clocks. Left ungated, the header showed `Ended` and
 * `NEXT LOT CLOSES · LOT 11 · 04:22 left` at the same time, on a lot whose bid
 * buttons were already disabled. It is a real gap, not local seed damage, and
 * it happens to every auction as it winds down.
 */
export function AuctionCloseBar({
  auction,
  lots,
}: {
  auction: Auction;
  lots: LotSummary[];
}) {
  // The ticker lives here rather than on the screen, so a second passing
  // re-renders this line and not the whole list.
  const now = useNow();

  // An auction that is over has no next lot to close, whatever its lots' clocks
  // still say. **This is not the "gate on the clock, not `status`" rule being
  // broken** — that rule is about *can I bid*, where the clock is authoritative
  // because `status` lags the worker. Whether to raise an urgency bar is a
  // different question, and `ended` answers it outright.
  const live = auction.status === "live";

  const next = lots.reduce<LotSummary | null>((soonest, lot) => {
    if (!isLotOpen(lot.status, lot.effective_ends_at, now)) return soonest;
    if (!soonest) return lot;
    return Date.parse(lot.effective_ends_at) < Date.parse(soonest.effective_ends_at)
      ? lot
      : soonest;
  }, null);

  const finalHour =
    live && next !== null && now !== null && msUntil(next.effective_ends_at, now) <= FINAL_HOUR_MS;

  if (!finalHour || !next) {
    return (
      <p className="mx-auto w-full max-w-(--app-width) px-4 pb-1 text-xs text-text-muted">
        {auction.lot_count} {auction.lot_count === 1 ? "lot" : "lots"} ·{" "}
        {auction.status === "live" || auction.status === "scheduled"
          ? `Closes ${formatCloseDay(auction.ends_at)}`
          : "Closed"}
      </p>
    );
  }

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto w-full max-w-(--app-width) px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-text-muted">
            NEXT LOT CLOSES
          </span>
          <span className="tabular rounded-md border border-accent-edge bg-accent px-1.5 py-0.5 text-xs leading-none font-bold text-accent-ink">
            LOT {next.lot_number}
          </span>
          <Countdown endsAt={next.effective_ends_at} className="ml-auto" />
        </div>
        <p className="mt-1 text-xs text-text-muted">
          A bid in that lot&apos;s last {formatDuration(auction.anti_snipe_window_seconds)} pushes
          its closing time out by {formatDuration(auction.anti_snipe_extension_seconds)}, up to{" "}
          {auction.max_extensions} {auction.max_extensions === 1 ? "time" : "times"}.
        </p>
      </div>
    </div>
  );
}

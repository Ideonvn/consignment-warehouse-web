"use client";

import { formatRemaining } from "@/lib/format/time";
import { useNow } from "@/lib/hooks/useTicker";
import { cn } from "@/lib/utils/cn";

type CountdownProps = {
  /** ISO 8601 UTC close time — `effective_ends_at`, never the scheduled one. */
  endsAt: string;
  className?: string;
  /** Text shown once the clock runs out. */
  endedLabel?: string;
  /** Leading words for a `plain` clock, which supplies its own wording. */
  prefix?: string;
  /**
   * Not a bidding deadline. An auction's overall close, an "opens in", the
   * extension notice on a bid outcome: these keep the quiet duration wording
   * and never escalate, because an alarm on a clock nobody bids against is
   * crying wolf.
   */
  plain?: boolean;
};

/** Sits in the `hours` tier: today, but not yet an alarm. */
function ClockMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.5V8l2.25 1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Live remainder against the server clock, so a skewed device clock can never
 * show the wrong close time on a lot someone is bidding on.
 *
 * **Urgency is a function of the clock, not of the layout.** One component, five
 * tiers (see `ClockTier`): six days out it is the same muted line round 1 asked
 * for; inside the final hour it is the filled alarm. Nothing new is fetched to
 * do it — `effective_ends_at` already ticks against `useNow()`.
 *
 * **The final hour is a filled alarm, not red text.** It used to be the same
 * small muted line recoloured, which is easy to miss on the one screen where
 * missing it costs the lot. Four things change at once and only one of them is
 * colour: the clock gains a solid `--danger` background, its ink flips to
 * `--on-fill`, the type goes up a step and to bold. In the final *minute* a
 * fifth is added — it breathes.
 *
 * Under `prefers-reduced-motion` the breathing stops and **everything else
 * stays** — the global reduce rule snaps the animation to its final frame, and
 * that frame is deliberately the full-strength pill rather than the dim half of
 * the cycle. Colour is never the only signal, for the same reason.
 *
 * Callers reserve this height whether or not the clock is urgent, so crossing a
 * threshold changes no layout and pushes nothing off screen.
 */
export function Countdown({
  endsAt,
  className,
  endedLabel = "Ended",
  prefix,
  plain = false,
}: CountdownProps) {
  const now = useNow();

  if (now === null) {
    // Pre-hydration: hold the space rather than render a time we can't trust.
    return <span className={cn("tabular opacity-0", className)}>0:00</span>;
  }

  const { ended, tier, alarm, urgent, label, durationLabel } = formatRemaining(endsAt, now);

  if (plain) {
    return (
      <span className={cn("tabular", className)}>
        {ended ? endedLabel : `${prefix ? `${prefix} ` : ""}${durationLabel}`}
      </span>
    );
  }

  return (
    <span
      // A live region: the visual alarm is worth nothing to a screen reader, and
      // "polite" so it lands between announcements rather than cutting one off.
      aria-live={alarm ? "polite" : undefined}
      className={cn(
        "tabular inline-flex items-center gap-1",
        alarm &&
          "rounded-md bg-danger px-1.5 py-0.5 text-sm leading-none font-bold text-on-fill",
        urgent && "animate-urgent",
        tier === "hours" && "font-medium text-text",
        className,
      )}
    >
      {!ended && tier === "hours" ? <ClockMark /> : null}
      {ended ? endedLabel : label}
    </span>
  );
}

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
  prefix?: string;
  /**
   * Suppress the final-minute treatment. For clocks that are not a bidding
   * deadline — an auction's overall close, "opens in" — where a lot-level alarm
   * would be crying wolf.
   */
  plain?: boolean;
};

/**
 * Live remainder against the server clock, so a skewed device clock can never
 * show the wrong close time on a lot someone is bidding on.
 *
 * **The last minute is a filled alarm, not red text.** It used to be the same
 * small muted line recoloured, which is easy to miss on the one screen where
 * missing it costs the lot. Four things change at once and only one of them is
 * colour: the clock gains a solid `--danger` background, its ink flips to
 * `--on-fill`, the type goes up a step and to bold, and it breathes.
 *
 * Under `prefers-reduced-motion` the breathing stops and **everything else
 * stays** — the global reduce rule snaps the animation to its final frame, and
 * that frame is deliberately the full-strength pill rather than the dim half of
 * the cycle. Colour is never the only signal, for the same reason.
 *
 * The row reserves this height whether or not the clock is urgent, so crossing
 * into the final minute changes no layout and pushes nothing off screen.
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

  const { ended, urgent, label } = formatRemaining(endsAt, now);
  const alarm = urgent && !plain;

  return (
    <span
      // A live region: the visual alarm is worth nothing to a screen reader, and
      // "polite" so it lands between announcements rather than cutting one off.
      aria-live={alarm ? "polite" : undefined}
      className={cn(
        "tabular",
        alarm &&
          "animate-urgent inline-flex items-center rounded-md bg-danger px-1.5 py-0.5 text-sm leading-none font-bold text-on-fill",
        !alarm && urgent && "text-danger",
        className,
      )}
    >
      {ended ? endedLabel : `${prefix ? `${prefix} ` : ""}${label}`}
    </span>
  );
}

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
};

/**
 * Live remainder against the server clock, so a skewed device clock can never
 * show the wrong close time on a lot someone is bidding on.
 */
export function Countdown({ endsAt, className, endedLabel = "Ended", prefix }: CountdownProps) {
  const now = useNow();

  if (now === null) {
    // Pre-hydration: hold the space rather than render a time we can't trust.
    return <span className={cn("tabular opacity-0", className)}>0:00</span>;
  }

  const { ended, urgent, label } = formatRemaining(endsAt, now);

  return (
    <span className={cn("tabular", urgent && "text-danger", className)}>
      {ended ? endedLabel : `${prefix ? `${prefix} ` : ""}${label}`}
    </span>
  );
}

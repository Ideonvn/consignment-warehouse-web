const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How loud a lot's clock should be. Urgency is a function of the clock, not a
 * permanent feature of the layout: at six days out a row is as quiet as it ever
 * was, and the same component escalates on its own as the close approaches.
 *
 * The thresholds, and why each one is where it is:
 *
 * - `far`   (> 48h)     nothing is imminent; a date is more use than a duration.
 * - `day`   (24h–48h)   near enough that a wall-clock time is actionable —
 *                       "tomorrow at 18:00" is something you can plan around,
 *                       "1d 4h" is not.
 * - `hours` (1h–24h)    today. Stronger than muted, with a clock mark, but no
 *                       alarm: an alarm that runs all day is crying wolf.
 * - `hour`  (60s–1h)    the last hour, where a bidder either watches or loses
 *                       the lot. This is where the final-minute treatment now
 *                       begins: filled `--danger`, `--on-fill` ink, a type step
 *                       up and bold weight.
 * - `final` (< 60s)     as before — the same pill, now breathing.
 */
export type ClockTier = "far" | "day" | "hours" | "hour" | "final";

export type Remaining = {
  totalMs: number;
  ended: boolean;
  tier: ClockTier;
  /** Inside the final hour: the filled-pill treatment. */
  alarm: boolean;
  /** Inside the final minute: the pill also breathes. */
  urgent: boolean;
  /** Self-describing phrase for a lot's bidding deadline. */
  label: string;
  /**
   * Bare duration — "6d 0h", "4h 12m", "09:42". For `plain` clocks, which are
   * not bidding deadlines and supply their own wording.
   */
  durationLabel: string;
};

/**
 * Time helpers take `now` as an argument rather than reading the clock, so
 * rendering stays pure. Callers get it from `useNow()`, which is anchored to the
 * server clock.
 */

export function msUntil(iso: string, now: number): number {
  return Date.parse(iso) - now;
}

const timeOfDay = new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
const weekday = new Intl.DateTimeFormat("en-ZA", { weekday: "long" });

/**
 * "tomorrow" is a calendar fact, not a 24-hour window: at 23:00 a close 47
 * hours out lands the day *after* tomorrow, and calling that "tomorrow" is
 * simply wrong. So the day tier compares local calendar days and names the
 * weekday when it isn't literally tomorrow.
 */
function dayWord(target: Date, now: Date): string {
  const startOf = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOf(target) - startOf(now)) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return weekday.format(target);
}

/**
 * The remaining time, its tier, and both wordings.
 *
 * Deliberately coarse far out and second-precise near the close, which is when
 * a bidder is actually watching. Minutes are zero-padded through the whole
 * final hour ("09:42", "00:42") so the pill's width never changes as it counts
 * down — a countdown that reflows the row it sits in is worse than a quiet one.
 */
export function formatRemaining(iso: string, now: number): Remaining {
  const totalMs = msUntil(iso, now);

  if (totalMs <= 0) {
    return {
      totalMs: 0,
      ended: true,
      tier: "final",
      alarm: false,
      urgent: false,
      label: "Ended",
      durationLabel: "Ended",
    };
  }

  const days = Math.floor(totalMs / DAY);
  const hours = Math.floor((totalMs % DAY) / HOUR);
  const minutes = Math.floor((totalMs % HOUR) / MINUTE);
  const seconds = Math.floor((totalMs % MINUTE) / SECOND);

  // Unchanged from before the escalation existed: what a `plain` clock renders.
  let durationLabel: string;
  if (days > 0) durationLabel = `${days}d ${hours}h`;
  else if (hours > 0) durationLabel = `${hours}h ${String(minutes).padStart(2, "0")}m`;
  else durationLabel = `${minutes}:${String(seconds).padStart(2, "0")}`;

  if (totalMs > 2 * DAY) {
    return {
      totalMs,
      ended: false,
      tier: "far",
      alarm: false,
      urgent: false,
      label: `Closes in ${durationLabel}`,
      durationLabel,
    };
  }

  if (totalMs > DAY) {
    const target = new Date(Date.parse(iso));
    return {
      totalMs,
      ended: false,
      tier: "day",
      alarm: false,
      urgent: false,
      label: `Closes ${dayWord(target, new Date(now))} at ${timeOfDay.format(target)}`,
      durationLabel,
    };
  }

  if (totalMs > HOUR) {
    return {
      totalMs,
      ended: false,
      tier: "hours",
      alarm: false,
      urgent: false,
      label: `${hours}h ${String(minutes).padStart(2, "0")}m left`,
      durationLabel,
    };
  }

  const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return {
    totalMs,
    ended: false,
    tier: totalMs < MINUTE ? "final" : "hour",
    alarm: true,
    urgent: totalMs < MINUTE,
    label: `${clock} left`,
    durationLabel,
  };
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 minutes ago" for bid history. */
export function formatRelativePast(iso: string, now: number): string {
  const deltaMs = Date.parse(iso) - now;
  const abs = Math.abs(deltaMs);

  if (abs < MINUTE) return "just now";
  if (abs < HOUR) return relative.format(Math.round(deltaMs / MINUTE), "minute");
  if (abs < DAY) return relative.format(Math.round(deltaMs / HOUR), "hour");
  return relative.format(Math.round(deltaMs / DAY), "day");
}

const dateTime = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

const longDateTime = new Intl.DateTimeFormat("en-ZA", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "Monday, 14 September at 18:00" — the auction header's quiet line. */
export function formatCloseDay(iso: string): string {
  const parts = longDateTime.formatToParts(new Date(iso));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("weekday")}, ${pick("day")} ${pick("month")} at ${pick("hour")}:${pick("minute")}`;
}

// Component options, not `dateStyle`/`timeStyle`: Intl rejects mixing the two
// forms, and naming the zone is the whole point of this formatter.
const zoned = new Intl.DateTimeFormat("en-ZA", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

/**
 * The same instant with the zone named. The information sheet answers "when
 * does this close" for someone who may not be in the warehouse's timezone, and
 * a bare "18:00" does not answer it.
 */
export function formatZonedDateTime(iso: string): string {
  return zoned.format(new Date(iso));
}

/**
 * A span of time in words: "45 sec", "5 min", "2h 30m", "4d 22h".
 *
 * Used for the anti-snipe window read off the auction (small) and for how far a
 * clock just moved (which an admin cascade can make days). It has to cover both
 * — "7120 min earlier" is not a number anyone can picture.
 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} sec`;
  if (total < 3600) return `${Math.round(total / 60)} min`;
  if (total < 86400) {
    const hours = Math.floor(total / 3600);
    return `${hours}h ${Math.round((total % 3600) / 60)}m`;
  }
  const days = Math.floor(total / 86400);
  return `${days}d ${Math.round((total % 86400) / 3600)}h`;
}

export function hasEnded(iso: string, now: number): boolean {
  return msUntil(iso, now) <= 0;
}

/**
 * A lot is only biddable while it is `live` *and* its clock has not run out.
 *
 * The backend leaves `status: "live"` until its closer runs, but rejects bids
 * with a 409 the moment `effective_ends_at` passes — so the UI must not invite
 * a bid it knows will be refused.
 */
export function isLotOpen(
  status: string,
  effectiveEndsAt: string,
  now: number | null,
): boolean {
  if (status !== "live") return false;
  // Before the first clock sample, trust the server's status.
  return now === null || Date.parse(effectiveEndsAt) > now;
}

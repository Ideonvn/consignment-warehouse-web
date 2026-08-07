const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type Remaining = {
  totalMs: number;
  ended: boolean;
  /** Under a minute — the point where every second matters. */
  urgent: boolean;
  label: string;
};

/**
 * Time helpers take `now` as an argument rather than reading the clock, so
 * rendering stays pure. Callers get it from `useNow()`, which is anchored to the
 * server clock.
 */

export function msUntil(iso: string, now: number): number {
  return Date.parse(iso) - now;
}

/**
 * "2d 4h" / "4h 12m" / "12:05" / "0:09". Deliberately coarse far out and
 * second-precise near the close, which is when a bidder is actually watching.
 */
export function formatRemaining(iso: string, now: number): Remaining {
  const totalMs = msUntil(iso, now);

  if (totalMs <= 0) {
    return { totalMs: 0, ended: true, urgent: false, label: "Ended" };
  }

  const days = Math.floor(totalMs / DAY);
  const hours = Math.floor((totalMs % DAY) / HOUR);
  const minutes = Math.floor((totalMs % HOUR) / MINUTE);
  const seconds = Math.floor((totalMs % MINUTE) / SECOND);

  let label: string;
  if (days > 0) label = `${days}d ${hours}h`;
  else if (hours > 0) label = `${hours}h ${String(minutes).padStart(2, "0")}m`;
  else label = `${minutes}:${String(seconds).padStart(2, "0")}`;

  return { totalMs, ended: false, urgent: totalMs < MINUTE, label };
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

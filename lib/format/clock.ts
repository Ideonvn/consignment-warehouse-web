/**
 * Server-anchored clock.
 *
 * Countdowns on a money screen must not depend on the user's device clock. Every
 * API response carries a `Date` header; we keep the offset between it and local
 * time and every countdown reads `serverNow()` instead of `Date.now()`.
 */

let offsetMs = 0;
let synced = false;

/** Half the round trip is assumed to be the response leg. */
export function recordServerDate(dateHeader: string | null, requestStartedAt: number): void {
  if (!dateHeader) return;
  const serverMs = Date.parse(dateHeader);
  if (Number.isNaN(serverMs)) return;

  const now = Date.now();
  const latency = (now - requestStartedAt) / 2;
  const next = serverMs + latency - now;

  // The Date header has one-second resolution, so smooth rather than snap —
  // otherwise every response jitters the countdown by up to a second.
  offsetMs = synced ? offsetMs * 0.8 + next * 0.2 : next;
  synced = true;
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function clockOffsetMs(): number {
  return offsetMs;
}

export function isClockSynced(): boolean {
  return synced;
}

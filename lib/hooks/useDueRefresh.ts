"use client";

import { useEffect, useRef } from "react";
import { serverNow } from "@/lib/format/clock";

/** While the server catches up, ask again on this cadence. */
const RETRY_MS = 5_000;
/** Never sleep longer than this, so a suspended tab re-checks on wake. */
const MAX_SLEEP_MS = 30_000;

/**
 * Ask the server again the moment a countdown runs out.
 *
 * A countdown reaching zero changes what the user may do, but the status that
 * says so is set by the lifecycle worker on its next tick — so client and server
 * disagree from that moment, and only the client knows to resolve it. Left
 * alone, an auction sits on "Opening…" until someone reloads.
 *
 * A React Query `refetchInterval` looks like the obvious tool and is not: it is
 * only recomputed when the component re-renders, and these screens don't re-render
 * on the tick — their `Countdown` children do. The interval therefore stays at
 * whatever it was when the data last arrived, which is "no polling".
 *
 * So this schedules a real timer for the boundary itself, then retries on a slow
 * cadence until `dueAt` changes — which it does as soon as the server agrees,
 * because the caller derives it from the status. Self-terminating.
 */
export function useDueRefresh(dueAt: string | null | undefined, onDue: () => void): void {
  const onDueRef = useRef(onDue);
  useEffect(() => {
    onDueRef.current = onDue;
  });

  useEffect(() => {
    if (!dueAt) return;

    const due = Date.parse(dueAt);
    if (Number.isNaN(due)) return;

    let timer: ReturnType<typeof setTimeout>;

    const check = () => {
      const remaining = due - serverNow();
      if (remaining > 0) {
        // +250ms so the server has crossed the boundary too, never just short of it.
        timer = setTimeout(check, Math.min(remaining + 250, MAX_SLEEP_MS));
        return;
      }
      onDueRef.current();
      timer = setTimeout(check, RETRY_MS);
    };

    check();
    return () => clearTimeout(timer);
  }, [dueAt]);
}

/** The boundary an auction is waiting on, or null when it isn't waiting. */
export function auctionDueAt(auction: {
  status: string;
  starts_at: string;
  ends_at: string;
} | undefined): string | null {
  if (!auction) return null;
  if (auction.status === "scheduled") return auction.starts_at;
  if (auction.status === "live") return auction.ends_at;
  return null;
}

/** The soonest lot boundary in a list, or null if none are still running. */
export function soonestLotDueAt(
  lots: { status: string; effective_ends_at: string }[],
): string | null {
  const live = lots
    .filter((lot) => lot.status === "live")
    .map((lot) => lot.effective_ends_at)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return live[0] ?? null;
}

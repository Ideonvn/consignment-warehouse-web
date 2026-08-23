"use client";

import { create } from "zustand";
import { serverNow } from "@/lib/format/clock";
import { uuid } from "@/lib/utils/uuid";
import type { LotSummary } from "@/types/api";

/**
 * How long a swiped bid sits before it is sent.
 *
 * **Not configurable, and never zero.** On the stack a right swipe commits money,
 * and this window is the entire thing standing between an accidental thumb and a
 * bid that cannot be retracted — there is no retraction API, and voiding a placed
 * bid is an operator action that posts ledger reversals. The gesture is the
 * intent; this is the confirmation.
 */
export const CANCEL_WINDOW_MS = 5_000;

export type PendingBid = {
  auctionId: string;
  lot: LotSummary;
  currency: string;
  /** The server's figure, read from the lot. Never computed here. */
  amountMinor: number;
  /**
   * One key per pending bid, generated when the window starts and reused on any
   * retry, so a double fire returns the original bid instead of making a second.
   */
  clientRequestId: string;
  /** Server-anchored deadline; the runner's timer, not the ticker, does the firing. */
  dueAt: number;
};

type PendingBidState = {
  /**
   * One slot. A window is a grace period, not a queue: arming a second bid sends
   * the first rather than stacking them up, so there is never more than one bid
   * the user has not seen the outcome of.
   */
  pending: PendingBid | null;
  set: (pending: PendingBid | null) => void;
};

const usePendingBidStore = create<PendingBidState>((set) => ({
  pending: null,
  set: (pending) => set({ pending }),
}));

export function usePendingBid(): PendingBid | null {
  return usePendingBidStore((state) => state.pending);
}

/**
 * The commit itself lives in `PendingBidRunner`, which has the query client and
 * the outcome handling. The store keeps state; this is how a plain function like
 * `armPendingBid` reaches the effectful half.
 */
let commit: ((pending: PendingBid) => void) | null = null;

export function registerPendingBidCommit(fn: (pending: PendingBid) => void): () => void {
  commit = fn;
  return () => {
    if (commit === fn) commit = null;
  };
}

/** Start a window, sending any bid already waiting rather than queueing behind it. */
export function armPendingBid(input: {
  auctionId: string;
  lot: LotSummary;
  currency: string;
  amountMinor: number;
}): void {
  flushPendingBid();
  usePendingBidStore.getState().set({
    ...input,
    clientRequestId: uuid(),
    dueAt: serverNow() + CANCEL_WINDOW_MS,
  });
}

/**
 * Empty the slot and hand back what was in it, in one step.
 *
 * Everything that sends a bid goes through this, because clearing and committing
 * have to be atomic: a commit that leaves the slot full leaves the countdown on
 * screen for a bid that has already gone, and the next flush would send it a
 * second time. Only the idempotency key would stand between that and two bids.
 */
export function takePendingBid(): PendingBid | null {
  const { pending, set } = usePendingBidStore.getState();
  if (pending) set(null);
  return pending;
}

/** Send it now: the user did something deliberate that means they meant it. */
export function flushPendingBid(): void {
  const pending = takePendingBid();
  if (pending) commit?.(pending);
}

/**
 * Drop it without sending. The swipe stays recorded, so the lot is still in My
 * bids and the user can bid from there — only the immediacy is lost.
 */
export function cancelPendingBid(): PendingBid | null {
  return takePendingBid();
}

export function getPendingBid(): PendingBid | null {
  return usePendingBidStore.getState().pending;
}

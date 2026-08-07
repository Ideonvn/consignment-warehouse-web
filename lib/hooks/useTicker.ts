"use client";

import { useSyncExternalStore } from "react";
import { serverNow } from "@/lib/format/clock";

/**
 * One interval for the whole app, and the only place the clock is read.
 *
 * Components must not call `Date.now()` during render (it is impure and makes a
 * render's output depend on when it happened), so the current time is sampled in
 * the interval callback and handed to components as a value.
 */
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
/** 0 means "not sampled yet" — the server render and the hydration render. */
let nowMs = 0;

function subscribe(onStoreChange: () => void): () => void {
  subscribers.add(onStoreChange);

  if (!timer) {
    nowMs = serverNow();
    timer = setInterval(() => {
      nowMs = serverNow();
      for (const notify of subscribers) notify();
    }, 1000);
  }

  return () => {
    subscribers.delete(onStoreChange);
    if (subscribers.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
      nowMs = 0;
    }
  };
}

const getSnapshot = () => nowMs;
const getServerSnapshot = () => 0;

/**
 * Server-anchored "now", refreshed every second. `null` until the first sample,
 * which keeps server and hydration renders identical.
 */
export function useNow(): number | null {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return value === 0 ? null : value;
}

"use client";

import { useSyncExternalStore } from "react";

export const BROWSE_LAYOUTS = ["stack", "list", "gallery"] as const;
export type BrowseLayout = (typeof BROWSE_LAYOUTS)[number];

/** The stack is the default, and the default has to be the thing that works for everyone. */
export const DEFAULT_LAYOUT: BrowseLayout = "stack";

const KEY = "cw.browse_layout";

/**
 * How this device browses an auction.
 *
 * `localStorage`, per device, never synced — the same reasoning CLAUDE.md
 * records for the theme: someone can genuinely want cards on a phone and a list
 * on a laptop, so syncing it across devices would be wrong behaviour rather than
 * a missing feature. Do not add a user field for this.
 */
function read(): BrowseLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return BROWSE_LAYOUTS.includes(raw as BrowseLayout) ? (raw as BrowseLayout) : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changing the preference should not leave this one stale.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function setBrowseLayout(layout: BrowseLayout): void {
  try {
    window.localStorage.setItem(KEY, layout);
  } catch {
    // A blocked or full storage costs the preference, not the app.
  }
  for (const listener of listeners) listener();
}

/**
 * The chosen layout, or `null` when nobody has chosen yet — which is what the
 * first-run chooser keys off. Server snapshot is `null` too, and the whole
 * authenticated tree renders behind `AuthGuard`'s client-side skeleton, so there
 * is no markup to mismatch and no flash of the wrong layout.
 */
export function useBrowseLayoutPreference(): BrowseLayout | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** The layout to actually render with. */
export function useBrowseLayout(): BrowseLayout {
  return useBrowseLayoutPreference() ?? DEFAULT_LAYOUT;
}

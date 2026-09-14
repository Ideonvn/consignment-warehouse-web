"use client";

import { useEffect, useState } from "react";

/**
 * How long a bid button ignores presses after its figure changes.
 *
 * Measured, not guessed: a double tap 191ms apart on a contested lot sent the
 * first press, took a 422 back in 21ms, and the second tap landed on the button
 * already re-armed with the new, higher figure — a bid at an amount shown for
 * ~170ms. The second tap of a double tap arrives inside the platform's
 * double-tap timeout (Android 300ms, iOS ~350ms) of the first, and the figure can
 * only change after it, so 500ms covers it; nobody reads a new amount and
 * deliberately presses in less. See NOTES.md.
 */
export const NEW_FIGURE_HOLD_MS = 500;

/**
 * Whether `figure` has been on screen long enough to be pressed on purpose.
 *
 * A button that places a bid with no confirmation must never commit at an amount
 * that changed under a travelling thumb. `holdOnMount` decides whether the first
 * figure is held too: yes for a sheet that has just slid up under a finger, no
 * for a list row that has always shown it.
 */
export function useSettledFigure(figure: number, { holdOnMount }: { holdOnMount: boolean }) {
  const [settled, setSettled] = useState<number | null>(holdOnMount ? null : figure);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(figure), NEW_FIGURE_HOLD_MS);
    return () => clearTimeout(timer);
  }, [figure]);
  return settled === figure;
}

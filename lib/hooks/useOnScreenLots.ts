"use client";

import { useCallback, useRef, useState, type RefCallback } from "react";

/**
 * How far beyond the viewport a row still counts as on screen: one viewport
 * above and one below. A percentage scales with the screen, so a phone and a
 * desktop both keep a full screen of rows subscribed ahead of the scroll, and at
 * a reading pace a row is live well before it arrives.
 */
const ON_SCREEN_MARGIN = "100% 0px";

/**
 * How long the on-screen set has to stay still before subscriptions follow it.
 * The socket accepts 120 messages a minute and silently refuses the rest, so a
 * fling past fifty rows must not send a subscribe and an unsubscribe per row.
 */
const SETTLE_MS = 250;

/**
 * Which lot rows are on screen, plus a margin — for subscribing the socket to
 * exactly those.
 *
 * Attach `watchRow` as the ref of each row's element and give that element
 * `data-lot-id`. The first set is reported at once, so a page load subscribes
 * without waiting; later changes wait for `SETTLE_MS` of stillness.
 */
export function useOnScreenLots(): {
  onScreen: ReadonlySet<string>;
  watchRow: RefCallback<HTMLElement>;
} {
  const [onScreen, setOnScreen] = useState<ReadonlySet<string>>(() => new Set());
  const visible = useRef(new Set<string>());
  const observer = useRef<IntersectionObserver | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reported = useRef(false);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const flush = () => {
      timer.current = null;
      reported.current = true;
      setOnScreen(new Set(visible.current));
    };
    if (reported.current) timer.current = setTimeout(flush, SETTLE_MS);
    else flush();
  }, []);

  const watchRow = useCallback<RefCallback<HTMLElement>>(
    (node) => {
      if (!node) return;
      observer.current ??= new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.lotId;
            if (!id) continue;
            if (entry.isIntersecting) visible.current.add(id);
            else visible.current.delete(id);
          }
          schedule();
        },
        { rootMargin: ON_SCREEN_MARGIN },
      );
      const current = observer.current;
      current.observe(node);
      return () => {
        current.unobserve(node);
        // A row that unmounts never reports leaving, so it has to be taken out here.
        const id = node.dataset.lotId;
        if (id && visible.current.delete(id)) schedule();
      };
    },
    [schedule],
  );

  return { onScreen, watchRow };
}

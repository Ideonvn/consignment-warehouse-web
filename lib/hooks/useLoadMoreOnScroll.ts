"use client";

import { useEffect, useRef } from "react";

/**
 * Pulls the next page in when the end of the content comes into view.
 *
 * A scrolling layout has to page on scroll: the stack's "nearly out of cards"
 * trigger would leave everything past page one unreachable here.
 */
export function useLoadMoreOnScroll(hasMore: boolean, loadMore: () => void) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      // Start fetching a screen early, so the grid rarely shows a gap.
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return sentinel;
}

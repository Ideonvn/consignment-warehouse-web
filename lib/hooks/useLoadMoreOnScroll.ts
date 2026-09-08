"use client";

import { useEffect, useRef } from "react";

/**
 * Pulls the next page in when the end of the content comes into view.
 *
 * The list shows the whole set at once, so paging has to follow the scroll: on
 * a large auction everything past the first page would otherwise be unreachable.
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

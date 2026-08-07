"use client";

import { useEffect } from "react";
import { realtime } from "@/lib/realtime/socket";

/**
 * Subscribes to the lots currently on screen and releases them on the way out.
 * Reference counted in the client, so two screens showing the same lot don't
 * cancel each other's subscription.
 */
export function useLotSubscription(lotIds: string[]): void {
  // The array identity changes every render; the ids rarely do.
  const key = lotIds.join(",");

  useEffect(() => {
    const ids = key.length > 0 ? key.split(",") : [];
    if (ids.length === 0) return;

    realtime.retain(ids);
    return () => realtime.release(ids);
  }, [key]);
}

"use client";

import { useEffect } from "react";
import { realtime } from "@/lib/realtime/socket";
import { useRealtimeStore } from "@/lib/realtime/store";

export type LotSubscription = {
  id: string;
  /**
   * The lot's `bid_sequence` as of the last REST read, when the caller has it.
   * This is the resume point for a reconnect: without it, a client that has not
   * yet seen a bid over the socket has nothing to replay from and silently
   * misses everything that happened while it was disconnected.
   */
  sequence?: number;
};

/**
 * Subscribes to the lots currently on screen and releases them on the way out.
 * Reference counted in the client, so two screens showing the same lot don't
 * cancel each other's subscription.
 */
export function useLotSubscription(lots: LotSubscription[]): void {
  // Both arrays change identity every render while their contents rarely do,
  // so effects key off serialized forms instead.
  const idKey = lots.map((lot) => lot.id).join(",");
  const sequenceKey = lots.map((lot) => `${lot.id}:${lot.sequence ?? 0}`).join(",");

  useEffect(() => {
    const { noteSequence } = useRealtimeStore.getState();
    for (const entry of sequenceKey.split(",")) {
      const [id, raw] = entry.split(":");
      const sequence = Number(raw);
      if (id && sequence > 0) noteSequence(id, sequence);
    }
  }, [sequenceKey]);

  useEffect(() => {
    const ids = idKey.length > 0 ? idKey.split(",") : [];
    if (ids.length === 0) return;

    realtime.retain(ids);
    return () => realtime.release(ids);
  }, [idKey]);
}

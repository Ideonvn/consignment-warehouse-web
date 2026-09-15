"use client";

import { useEffect, useRef } from "react";
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
  // An unknown sequence stays empty rather than becoming 0: 0 is a real
  // position ("no bids yet") and must not be claimed for a lot not yet read.
  const sequenceKey = lots.map((lot) => `${lot.id}:${lot.sequence ?? ""}`).join(",");

  useEffect(() => {
    const { noteSequence } = useRealtimeStore.getState();
    for (const entry of sequenceKey.split(",")) {
      const [id, raw] = entry.split(":");
      if (id && raw !== "" && raw !== undefined) noteSequence(id, Number(raw));
    }
  }, [sequenceKey]);

  // Only what changed is retained or released. A list whose on-screen set moves
  // with the scroll would otherwise unsubscribe and resubscribe every row that
  // stayed put, replaying each one's events and spending the socket's message
  // budget on nothing.
  const held = useRef<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const next = new Set(idKey.length > 0 ? idKey.split(",") : []);
    const removed = [...held.current].filter((id) => !next.has(id));
    const added = [...next].filter((id) => !held.current.has(id));
    held.current = next;
    // Release first, so the room it frees is there for what arrives.
    if (removed.length > 0) realtime.release(removed);
    if (added.length > 0) realtime.retain(added);
  }, [idKey]);

  useEffect(
    () => () => {
      realtime.release([...held.current]);
      held.current = new Set();
    },
    [],
  );
}

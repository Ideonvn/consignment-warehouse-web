import { create } from "zustand";

export type RealtimeStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  /** Given up for now — the user is told, and a retry is still scheduled. */
  | "offline";

/**
 * Something that just happened to one lot, shown briefly **inside that lot's
 * card**. An alert about lot 2 floating in the gap between lot 2 and lot 3
 * belongs to neither.
 *
 * `extended` and `rescheduled` are deliberately different kinds and never share
 * copy. An extension is anti-snipe and can only push the close *later*; a
 * reschedule is an admin moving the auction's clock and can pull it *earlier*.
 * Calling a reschedule an extension is a lie to the user.
 */
export type LotNotice =
  | { kind: "bid"; at: number; amountMinor: number }
  | { kind: "extended"; at: number; addedMs: number | null }
  | { kind: "rescheduled"; at: number; deltaMs: number | null };

/** Own bid sequences kept per lot; only the recent ones can still arrive. */
const OWN_SEQUENCE_MEMORY = 20;

type RealtimeState = {
  status: RealtimeStatus;
  /** Highest bid `sequence` seen per lot; the resume point after a reconnect. */
  lastSequence: Record<string, number>;
  /** Bumped when a lot's price moves, so the figure can pulse. */
  pulses: Record<string, number>;
  /** The latest transient alert per lot. Replaced, not queued. */
  notices: Record<string, LotNotice>;
  /**
   * Sequences this client's own bids produced, so the socket echo of a bid the
   * user just placed is never announced back to them as "another bidder".
   */
  ownSequences: Record<string, number[]>;
  /**
   * Lots with a bid of ours in flight, and until when.
   *
   * **The socket echo routinely arrives before the HTTP response**, so the
   * sequence list alone is always a step behind: measured against the real
   * backend, a bidder's own press announced itself back to them as somebody
   * else. Marking the lot at send time closes that window. The cost is that a
   * rival's proxy counter-bid landing inside the same couple of seconds goes
   * unannounced — much the better error, since the user is about to be shown
   * the outbid outcome anyway.
   */
  ownBidPendingUntil: Record<string, number>;
  setStatus: (status: RealtimeStatus) => void;
  noteSequence: (lotId: string, sequence: number) => void;
  pulse: (lotId: string) => void;
  notice: (lotId: string, notice: LotNotice) => void;
  noteOwnBids: (lotId: string, sequences: number[]) => void;
  expectOwnBid: (lotId: string, until: number) => void;
  releaseOwnBid: (lotId: string) => void;
  reset: () => void;
};

export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: "idle",
  lastSequence: {},
  pulses: {},
  notices: {},
  ownSequences: {},
  ownBidPendingUntil: {},
  setStatus: (status) => set({ status }),
  noteSequence: (lotId, sequence) =>
    set((state) => {
      // A first 0 is recorded, not ignored: "this lot has no bids yet" is a
      // resume point, and without it a lot subscribed later replays nothing.
      const current = state.lastSequence[lotId];
      if (current !== undefined && sequence <= current) return state;
      return { lastSequence: { ...state.lastSequence, [lotId]: sequence } };
    }),
  pulse: (lotId) =>
    set((state) => ({ pulses: { ...state.pulses, [lotId]: (state.pulses[lotId] ?? 0) + 1 } })),
  notice: (lotId, notice) => set((state) => ({ notices: { ...state.notices, [lotId]: notice } })),
  noteOwnBids: (lotId, sequences) =>
    set((state) => {
      const merged = [...(state.ownSequences[lotId] ?? []), ...sequences];
      // The exact sequences take over from the time window the moment they land.
      const ownBidPendingUntil = { ...state.ownBidPendingUntil };
      delete ownBidPendingUntil[lotId];
      return {
        ownBidPendingUntil,
        ownSequences: {
          ...state.ownSequences,
          [lotId]: merged.slice(-OWN_SEQUENCE_MEMORY),
        },
      };
    }),
  expectOwnBid: (lotId, until) =>
    set((state) => ({ ownBidPendingUntil: { ...state.ownBidPendingUntil, [lotId]: until } })),
  releaseOwnBid: (lotId) =>
    set((state) => {
      if (state.ownBidPendingUntil[lotId] === undefined) return state;
      const ownBidPendingUntil = { ...state.ownBidPendingUntil };
      delete ownBidPendingUntil[lotId];
      return { ownBidPendingUntil };
    }),
  reset: () =>
    set({
      status: "idle",
      lastSequence: {},
      pulses: {},
      notices: {},
      ownSequences: {},
      ownBidPendingUntil: {},
    }),
}));

export function useRealtimeStatus(): RealtimeStatus {
  return useRealtimeStore((state) => state.status);
}

/** Changes whenever this lot's price moved, so a component can flash it. */
export function usePricePulse(lotId: string): number {
  return useRealtimeStore((state) => state.pulses[lotId] ?? 0);
}

/**
 * The lot's pending alert, or undefined. A stable reference until a new event
 * replaces it, so a row can key an effect on identity alone.
 */
export function useLotNotice(lotId: string): LotNotice | undefined {
  return useRealtimeStore((state) => state.notices[lotId]);
}

/** True for a bid this client placed — its own echo, not somebody else's. */
export function isOwnBid(lotId: string, sequence: number, now: number): boolean {
  const state = useRealtimeStore.getState();
  if ((state.ownSequences[lotId] ?? []).includes(sequence)) return true;
  return now < (state.ownBidPendingUntil[lotId] ?? 0);
}

/**
 * A gap-free per-lot ordinal: anything more than one above what we've seen means
 * we missed events and should resync rather than render a hole.
 */
export function hasSequenceGap(lotId: string, sequence: number): boolean {
  const last = useRealtimeStore.getState().lastSequence[lotId] ?? 0;
  return last > 0 && sequence > last + 1;
}

/**
 * True for an event we have already applied.
 *
 * `subscribe` takes one `after_sequence` for the whole batch, so a reconnect
 * that resumes several lots at once has to pick a single resume point. We pick
 * the lowest — replaying a few events we already have is recoverable, whereas
 * skipping one leaves a permanent hole — and drop the duplicates here. Without
 * this, a replayed old bid would overwrite the current price with a stale one.
 */
export function isStaleSequence(lotId: string, sequence: number): boolean {
  const last = useRealtimeStore.getState().lastSequence[lotId] ?? 0;
  return sequence <= last;
}

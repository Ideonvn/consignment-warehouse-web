import { create } from "zustand";

export type RealtimeStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  /** Given up for now — the user is told, and a retry is still scheduled. */
  | "offline";

type RealtimeState = {
  status: RealtimeStatus;
  /** Highest bid `sequence` seen per lot; the resume point after a reconnect. */
  lastSequence: Record<string, number>;
  /** Bumped when a lot's price moves, so the figure can pulse. */
  pulses: Record<string, number>;
  setStatus: (status: RealtimeStatus) => void;
  noteSequence: (lotId: string, sequence: number) => void;
  pulse: (lotId: string) => void;
  reset: () => void;
};

export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: "idle",
  lastSequence: {},
  pulses: {},
  setStatus: (status) => set({ status }),
  noteSequence: (lotId, sequence) =>
    set((state) => {
      const current = state.lastSequence[lotId] ?? 0;
      if (sequence <= current) return state;
      return { lastSequence: { ...state.lastSequence, [lotId]: sequence } };
    }),
  pulse: (lotId) =>
    set((state) => ({ pulses: { ...state.pulses, [lotId]: (state.pulses[lotId] ?? 0) + 1 } })),
  reset: () => set({ status: "idle", lastSequence: {}, pulses: {} }),
}));

export function useRealtimeStatus(): RealtimeStatus {
  return useRealtimeStore((state) => state.status);
}

/** Changes whenever this lot's price moved, so a component can flash it. */
export function usePricePulse(lotId: string): number {
  return useRealtimeStore((state) => state.pulses[lotId] ?? 0);
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

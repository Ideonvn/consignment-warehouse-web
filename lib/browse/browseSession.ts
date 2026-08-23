import { create } from "zustand";
import type { SwipeDirection } from "@/types/api";

/**
 * One reversible thing the user did, newest last.
 *
 * Passes, bid-sheet swipes and skips share this list so undo walks all three in
 * the order they actually happened — undoing a skip that came after a pass must
 * bring the skip back first, not the pass.
 */
export type BrowseAction =
  | { kind: "decision"; lotId: string; direction: SwipeDirection }
  | { kind: "skip"; lotId: string };

/**
 * Where the gallery was standing when it handed over to the stack.
 *
 * A lot id plus the pixel offset it sat at, and the id order at that moment.
 * Never an index: the user goes to the stack to resolve lots, so the tile they
 * left from is usually gone when they come back and every index after it has
 * moved. This lives in the store rather than a ref because the grid unmounts
 * while the stack is showing, and a ref would go with it.
 */
export type GalleryAnchor = { lotId: string; offset: number; order: string[] };

type Session = {
  history: BrowseAction[];
  /**
   * Lot number the stack was opened at from the gallery, or null for the natural
   * order. A *number*, never a lot id: the lot it names is usually the first one
   * resolved, and an anchor that disappears when its element does would snap the
   * stack back to lot 1 exactly when the user acted on the tile they tapped.
   */
  anchorLotNumber: number | null;
  galleryAnchor: GalleryAnchor | null;
};

const EMPTY: Session = { history: [], anchorLotNumber: null, galleryAnchor: null };

type BrowseSessionState = {
  /** Keyed by auction id: two auctions browsed in one session don't share a history. */
  sessions: Record<string, Session>;
  push: (auctionId: string, action: BrowseAction) => void;
  /** Drop the newest entry — undo. */
  pop: (auctionId: string) => void;
  /** Put an entry back after the server refused to undo it. */
  restore: (auctionId: string, action: BrowseAction) => void;
  /** Remove a decision that failed to save, wherever it sits. */
  dropDecision: (auctionId: string, lotId: string) => void;
  setAnchor: (auctionId: string, lotNumber: number | null) => void;
  setGalleryAnchor: (auctionId: string, anchor: GalleryAnchor | null) => void;
  clearAll: () => void;
};

/**
 * Where a browse session lives between renders.
 *
 * Deliberately a store rather than component state: the layout switcher is on
 * `/profile`, so changing layout means leaving this screen and coming back, and
 * lot detail is a route of its own. Holding the history in the component would
 * mean skips and the undo history silently emptied every time the user did
 * either — the resolved set would survive (the server omits swiped lots) but the
 * ability to take any of it back would not.
 *
 * **Memory only, and never persisted.** A reload still clears it, which keeps a
 * skip what it has always been: "not now", not a list to manage later.
 */
export const useBrowseSession = create<BrowseSessionState>((set) => ({
  sessions: {},

  push: (auctionId, action) =>
    set((state) => {
      const current = state.sessions[auctionId] ?? EMPTY;
      return {
        sessions: {
          ...state.sessions,
          [auctionId]: { ...current, history: [...current.history, action] },
        },
      };
    }),

  pop: (auctionId) =>
    set((state) => {
      const current = state.sessions[auctionId] ?? EMPTY;
      return {
        sessions: {
          ...state.sessions,
          [auctionId]: { ...current, history: current.history.slice(0, -1) },
        },
      };
    }),

  restore: (auctionId, action) =>
    set((state) => {
      const current = state.sessions[auctionId] ?? EMPTY;
      return {
        sessions: {
          ...state.sessions,
          [auctionId]: { ...current, history: [...current.history, action] },
        },
      };
    }),

  dropDecision: (auctionId, lotId) =>
    set((state) => {
      const current = state.sessions[auctionId] ?? EMPTY;
      return {
        sessions: {
          ...state.sessions,
          [auctionId]: {
            ...current,
            history: current.history.filter(
              (entry) => !(entry.kind === "decision" && entry.lotId === lotId),
            ),
          },
        },
      };
    }),

  setAnchor: (auctionId, lotNumber) =>
    set((state) => {
      const current = state.sessions[auctionId] ?? EMPTY;
      return {
        sessions: {
          ...state.sessions,
          [auctionId]: { ...current, anchorLotNumber: lotNumber },
        },
      };
    }),

  setGalleryAnchor: (auctionId, galleryAnchor) =>
    set((state) => {
      const current = state.sessions[auctionId] ?? EMPTY;
      return {
        sessions: { ...state.sessions, [auctionId]: { ...current, galleryAnchor } },
      };
    }),

  clearAll: () => set({ sessions: {} }),
}));

export function useSessionFor(auctionId: string): Session {
  return useBrowseSession((state) => state.sessions[auctionId] ?? EMPTY);
}

/**
 * Called wherever a session ends.
 *
 * A memory-only store outlives a sign-out in the same tab, and on a shared
 * device that means the next person inherits the previous one's skip ordering
 * and undo history. Undoing into an inherited entry would send `DELETE /swipe`
 * for a lot the current user never touched — their swipe, on someone else's
 * account.
 */
export function clearBrowseSessions(): void {
  useBrowseSession.getState().clearAll();
}

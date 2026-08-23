"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { deleteSwipe, listLots, setSwipe } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import { soonestLotDueAt, useDueRefresh } from "@/lib/hooks/useDueRefresh";
import { useBrowseSession, useSessionFor } from "@/lib/browse/browseSession";
import type { LotCard, SwipeDirection } from "@/types/api";

const PAGE_SIZE = 20;
/** Fetch more while there are still cards to look at, never at zero. */
const PREFETCH_THRESHOLD = 6;

export type AuctionBrowse = {
  /**
   * The set, in the server's own lot-number order. This is what "the same lots
   * in every layout" means: list and gallery render exactly this, and the stack
   * renders a re-ordering of it. Membership lives here and nowhere else.
   */
  remaining: LotCard[];
  /** `remaining`, rotated to the gallery's entry point and with skips at the back. */
  cards: LotCard[];
  isPending: boolean;
  error: unknown;
  isFetchingMore: boolean;
  exhausted: boolean;
  canUndo: boolean;
  /** Records the swipe and advances the stack. Rolls back if the server refuses. */
  decide: (lot: LotCard, direction: SwipeDirection) => Promise<void>;
  /**
   * Move a lot to the back of the stack without deciding anything. Deliberately
   * local: nothing is sent, nothing is stored, and it is gone on reload — a skip
   * is "not now", not a preference the user then has to manage.
   */
  skip: (lot: LotCard) => void;
  /**
   * Reverse the most recent gesture, whatever it was and whichever layout made
   * it. A pass or an interested swipe also deletes the swipe server-side; a skip
   * was never sent, so undoing one is pure re-ordering and sends nothing.
   */
  undo: () => Promise<LotCard | null>;
  /**
   * Open the stack at a lot, for the gallery. Navigation, not a gesture: it
   * records nothing in the history and is not undoable.
   */
  openAt: (lotNumber: number | null) => void;
  anchorLotNumber: number | null;
  /**
   * Whether more pages exist, and how to ask for them.
   *
   * The stack pulls pages in when it is nearly out of cards, which is the right
   * trigger for one-at-a-time and the wrong one for a list or a grid: those show
   * the whole set at once, so on a large auction everything past the first page
   * would be invisible until the user had resolved their way down to six. The
   * scrolling layouts drive this from a sentinel at the bottom instead.
   */
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
};

/**
 * The lots a bidder still has to look at in one auction: server-unswiped, minus
 * the ones this session has already resolved. Local resolution is what makes a
 * swipe feel instant; the PUT catches up behind it.
 *
 * Called **once per screen** and handed to whichever layout is rendering. Three
 * renderers over one set is what stops the layouts disagreeing about which lots
 * are in the auction.
 */
export function useAuctionBrowse(
  auctionId: string,
  onError: (message: string) => void,
): AuctionBrowse {
  const queryClient = useQueryClient();
  const { history, anchorLotNumber } = useSessionFor(auctionId);
  const push = useBrowseSession((state) => state.push);
  const pop = useBrowseSession((state) => state.pop);
  const restore = useBrowseSession((state) => state.restore);
  const dropDecision = useBrowseSession((state) => state.dropDecision);
  const setAnchor = useBrowseSession((state) => state.setAnchor);

  const query = useInfiniteQuery({
    queryKey: queryKeys.lots(auctionId),
    queryFn: ({ pageParam }) =>
      listLots(auctionId, { limit: PAGE_SIZE, cursor: pageParam ?? undefined }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.meta.hasMore || !lastPage.meta.nextCursor) return undefined;
      const cursor = Number(lastPage.meta.nextCursor);
      return Number.isFinite(cursor) ? cursor : undefined;
    },
  });

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  const resolvedIds = useMemo(
    () =>
      new Set(
        history.filter((entry) => entry.kind === "decision").map((entry) => entry.lotId),
      ),
    [history],
  );

  /** Skipped ids, oldest first; a re-skip counts only at its newest position. */
  const skipped = useMemo(() => {
    const ids = history.filter((entry) => entry.kind === "skip").map((entry) => entry.lotId);
    return ids.filter((id, index) => ids.lastIndexOf(id) === index);
  }, [history]);

  const allLots = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );

  // The soonest closing lot on screen decides when this list re-asks.
  useDueRefresh(soonestLotDueAt(allLots), () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.lots(auctionId) });
  });

  /** The set. Server order is by lot number, so this needs no sorting of its own. */
  const remaining = useMemo(
    () => allLots.filter((lot) => !resolvedIds.has(lot.id)),
    [allLots, resolvedIds],
  );

  const cards = useMemo(() => {
    let ordered = remaining;

    /*
     * Rotation for "open the stack at this tile".
     *
     * The anchor is a lot *number*, compared as a threshold — never an element.
     * Tapping tile 12 and passing it must continue at 13, and an anchor that
     * pointed at the lot itself would evaporate on that first swipe. As a
     * threshold it also survives paging (later pages slot in by lot number) and
     * makes undo land correctly: undoing 39 while sitting on 40 sorts 39 back in
     * front, because both are on the near side of the threshold. Lots before the
     * anchor wrap to the end, so nothing becomes unreachable.
     */
    if (anchorLotNumber !== null) {
      ordered = [...ordered].sort((a, b) => {
        const aWrapped = a.lot_number < anchorLotNumber ? 1 : 0;
        const bWrapped = b.lot_number < anchorLotNumber ? 1 : 0;
        return aWrapped - bWrapped || a.lot_number - b.lot_number;
      });
    }

    if (skipped.length === 0) return ordered;

    // Skipped cards keep their relative order but sit behind everything else.
    const rank = new Map(skipped.map((id, index) => [id, index]));
    const kept = ordered.filter((lot) => !rank.has(lot.id));
    const moved = ordered
      .filter((lot) => rank.has(lot.id))
      .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    return [...kept, ...moved];
  }, [remaining, skipped, anchorLotNumber]);

  useEffect(() => {
    if (cards.length < PREFETCH_THRESHOLD && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [cards.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const decide = useCallback(
    async (lot: LotCard, direction: SwipeDirection) => {
      push(auctionId, { kind: "decision", lotId: lot.id, direction });
      try {
        await setSwipe(lot.id, direction);
        // The lot's own cache entry knows about the swipe now.
        queryClient.setQueryData(queryKeys.lot(lot.id), (existing: unknown) =>
          existing && typeof existing === "object"
            ? { ...existing, my_swipe: direction }
            : existing,
        );
      } catch {
        dropDecision(auctionId, lot.id);
        onError("That swipe didn't save. Try again.");
      }
    },
    [auctionId, push, dropDecision, queryClient, onError],
  );

  const skip = useCallback(
    (lot: LotCard) => {
      push(auctionId, { kind: "skip", lotId: lot.id });
    },
    [auctionId, push],
  );

  const undo = useCallback(async () => {
    const last = history[history.length - 1];
    if (!last) return null;

    const restored = allLots.find((lot) => lot.id === last.lotId) ?? null;
    pop(auctionId);

    // A skip never left the device. Dropping it from the history is the whole
    // undo: the lot stops being sorted to the back and returns to its place,
    // which — being the earliest lot still unresolved — is the front.
    if (last.kind === "skip") return restored;

    try {
      await deleteSwipe(last.lotId);
    } catch {
      restore(auctionId, last);
      onError("Couldn't undo that. Try again.");
      return null;
    }

    /*
     * Ask the server for the list again.
     *
     * Dropping the entry from the history is only half an undo. The lot has to
     * be back *in the set*, and the set comes from pages the server built while
     * the swipe still existed — so a lot swiped before the last fetch is absent
     * from them, and undoing it would delete the swipe and change nothing on
     * screen. It bit exactly where you would expect: pass in the list, switch
     * layout (which refetches), undo, and the lot stayed gone.
     *
     * One small request on a rare action, and always correct, which is the same
     * trade the bid history makes by refetching rather than splicing.
     */
    void queryClient.invalidateQueries({ queryKey: queryKeys.lots(auctionId) });
    return restored;
  }, [history, allLots, auctionId, pop, restore, onError, queryClient]);

  const openAt = useCallback(
    (lotNumber: number | null) => setAnchor(auctionId, lotNumber),
    [auctionId, setAnchor],
  );

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    remaining,
    cards,
    isPending: query.isPending,
    error: query.error,
    isFetchingMore: isFetchingNextPage,
    exhausted: cards.length === 0 && !hasNextPage && !query.isPending,
    canUndo: history.length > 0,
    decide,
    skip,
    undo,
    openAt,
    anchorLotNumber,
    hasMore: hasNextPage,
    loadMore,
    refetch: () => void query.refetch(),
  };
}

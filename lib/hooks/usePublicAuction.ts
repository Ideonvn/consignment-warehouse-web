"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getPublicAuction, listPublicLots, listPublicPrices } from "@/lib/api/publicEndpoints";
import { noteSeen } from "@/lib/public/seen";
import { useNow } from "@/lib/hooks/useTicker";
import { msUntil } from "@/lib/format/time";
import type { PublicAuction, PublicLotCard } from "@/types/api";

const PAGE_SIZE = 24;

/**
 * How often prices are re-read, and why each number is what it is.
 *
 * The endpoint sends `max-age=5`, which is the floor: polling faster than that
 * re-reads a cached body. 10s is the working rate — one step of staleness on a
 * price that moves in minutes — and it halves the request rate against 5s for
 * no perceptible loss. The exception is the close, where this auction model
 * actually moves: inside a lot's anti-snipe window, prices and clocks change on
 * every bid, so it drops to the floor.
 */
const POLL_LIVE_MS = 10_000;
const POLL_URGENT_MS = 5_000;
const POLL_SCHEDULED_MS = 60_000;
/** Under this much time left, a lot is in the part of the auction that moves. */
const URGENT_WINDOW_MS = 2 * 60_000;
/** Stop rather than poll a forgotten tab forever; interaction resumes it. */
const IDLE_STOP_MS = 10 * 60_000;

export type PublicAuctionBrowse = {
  auction: PublicAuction | undefined;
  lots: PublicLotCard[];
  isPending: boolean;
  error: unknown;
  isFetchingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
  /** True once polling has stopped itself; the UI offers to resume. */
  idle: boolean;
  resume: () => void;
};

/**
 * One public auction and its lots, with prices kept fresh by polling.
 *
 * Deliberately not shaped like `AuctionBrowse`: this one polls for prices,
 * because there is no anonymous socket. What the two share is the lot *shape*,
 * which is why `LotList` renders either without being told which it has.
 */
export function usePublicAuction(auctionId: string): PublicAuctionBrowse {
  const auctionQuery = useQuery({
    queryKey: ["public", "auction", auctionId],
    queryFn: () => getPublicAuction(auctionId),
  });

  const lotsQuery = useInfiniteQuery({
    queryKey: ["public", "lots", auctionId],
    queryFn: ({ pageParam }) =>
      listPublicLots(auctionId, { limit: PAGE_SIZE, cursor: pageParam ?? undefined }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || !lastPage.nextCursor) return undefined;
      const cursor = Number(lastPage.nextCursor);
      return Number.isFinite(cursor) ? cursor : undefined;
    },
  });

  const auction = auctionQuery.data;
  const lotPages = useMemo(
    () => lotsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [lotsQuery.data],
  );

  // Remember what rendered, so a later 404 can be honest about which kind it is.
  useEffect(() => {
    if (auction) noteSeen(auction.id);
  }, [auction]);

  /* ------------------------------------------------------------ polling --- */

  const now = useNow();
  const [idle, setIdle] = useState(false);
  // 0 until the first effect stamps it — reading the clock during render is impure.
  const lastInteraction = useRef(0);

  const soonestClose = useMemo(() => {
    // Before the ticker's first sample there is no clock to reason with, and
    // reading one here would be impure. The slower cadence is the safe default.
    if (now === null) return null;
    const live = lotPages.filter((lot) => lot.status === "live");
    if (live.length === 0) return null;
    return live.reduce(
      (soonest, lot) => Math.min(soonest, msUntil(lot.effective_ends_at, now)),
      Number.POSITIVE_INFINITY,
    );
  }, [lotPages, now]);

  const interval = useMemo(() => {
    if (idle || !auction) return false as const;
    if (auction.status === "scheduled") return POLL_SCHEDULED_MS;
    if (auction.status !== "live") return false as const;
    // The last two minutes of any visible lot is where the money moves.
    return soonestClose !== null && soonestClose < URGENT_WINDOW_MS
      ? POLL_URGENT_MS
      : POLL_LIVE_MS;
  }, [idle, auction, soonestClose]);

  const pricesQuery = useQuery({
    queryKey: ["public", "prices", auctionId],
    queryFn: () => listPublicPrices(auctionId),
    enabled: interval !== false && lotPages.length > 0,
    refetchInterval: interval,
    // Only while someone is looking: a hidden tab is not watching a price.
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  // Stop rather than poll a tab nobody has touched for ten minutes.
  useEffect(() => {
    lastInteraction.current = Date.now();
    const note = () => {
      lastInteraction.current = Date.now();
      setIdle(false);
    };
    const events = ["pointerdown", "keydown", "visibilitychange"] as const;
    for (const event of events) document.addEventListener(event, note);
    const timer = setInterval(() => {
      if (Date.now() - lastInteraction.current > IDLE_STOP_MS) setIdle(true);
    }, 30_000);
    return () => {
      for (const event of events) document.removeEventListener(event, note);
      clearInterval(timer);
    };
  }, []);

  /**
   * Prices patched onto the cards.
   *
   * The list response is the slow-moving part (titles, photos, lot numbers) and
   * the price feed is the fast one, so they are merged at render rather than
   * refetching the whole page. The countdown still runs client-side off
   * `useNow()`, so the clock ticks smoothly between steps.
   */
  const lots = useMemo(() => {
    const prices = pricesQuery.data;
    if (!prices || prices.length === 0) return lotPages;
    const byId = new Map(prices.map((price) => [price.id, price]));
    return lotPages.map((lot) => {
      const price = byId.get(lot.id);
      return price
        ? {
            ...lot,
            current_bid_minor: price.current_bid_minor,
            bid_count: price.bid_count,
            effective_ends_at: price.effective_ends_at,
          }
        : lot;
    });
  }, [lotPages, pricesQuery.data]);

  const loadMore = useCallback(() => {
    if (lotsQuery.hasNextPage && !lotsQuery.isFetchingNextPage) void lotsQuery.fetchNextPage();
  }, [lotsQuery]);

  return {
    auction,
    lots,
    isPending: auctionQuery.isPending || lotsQuery.isPending,
    /*
     * The price poll is included on purpose, and it is usually the one that
     * notices. Visibility can change mid-read, and when it does the auction and
     * lot queries are sitting on cached data with no reason to re-ask — the poll
     * is the only thing still talking to the server, so it is how a visitor
     * finds out within ten seconds rather than on their next navigation.
     */
    error: auctionQuery.error ?? lotsQuery.error ?? pricesQuery.error,
    isFetchingMore: lotsQuery.isFetchingNextPage,
    hasMore: Boolean(lotsQuery.hasNextPage),
    loadMore,
    refetch: () => {
      void auctionQuery.refetch();
      void lotsQuery.refetch();
    },
    idle,
    resume: () => {
      lastInteraction.current = Date.now();
      setIdle(false);
    },
  };
}

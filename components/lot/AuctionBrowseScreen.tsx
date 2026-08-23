"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuction } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import { auctionDueAt, useDueRefresh } from "@/lib/hooks/useDueRefresh";
import { useAuctionBrowse } from "@/lib/hooks/useAuctionBrowse";
import { useLotActions } from "@/lib/hooks/useLotActions";
import { useLotSubscription } from "@/lib/hooks/useLotSubscription";
import { useBrowseLayout, useBrowseLayoutPreference } from "@/lib/browse/layoutPreference";
import { CardStack } from "@/components/lot/CardStack";
import { LotList } from "@/components/lot/LotList";
import { GalleryLayout } from "@/components/lot/GalleryLayout";
import { FirstRunLayoutChooser } from "@/components/browse/FirstRunLayoutChooser";
import { BidSheet } from "@/components/bid/BidSheet";
import { PendingBidRunner } from "@/components/bid/PendingBidRunner";
import { Countdown } from "@/components/ui/Countdown";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { useToast } from "@/components/ui/Toast";

/** Lots kept subscribed: what's on screen plus a little ahead of it. */
const SUBSCRIBE_AHEAD = 12;

/**
 * One auction, browsed three ways.
 *
 * This screen owns the lot set, the swipe behaviour and the bid sheet, and hands
 * them to whichever layout is rendering. That ownership is the whole design: the
 * three layouts are renderers over one source of truth, so they cannot disagree
 * about which lots are in the auction, and there is exactly one code path from a
 * gesture or a button to `PUT /swipe`.
 */
export function AuctionBrowseScreen({ auctionId }: { auctionId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const { data: auction, isPending, error, refetch } = useQuery({
    queryKey: queryKeys.auction(auctionId),
    queryFn: () => getAuction(auctionId),
  });

  // Entering before the open is allowed, so this screen has to notice the moment
  // bidding actually opens — without being reloaded.
  useDueRefresh(auctionDueAt(auction), () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.auction(auctionId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.lots(auctionId) });
  });

  const onBrowseError = useCallback(
    (message: string) => showToast({ title: message, tone: "danger" }),
    [showToast],
  );

  const browse = useAuctionBrowse(auctionId, onBrowseError);
  const biddingOpen = auction?.status === "live";
  const actions = useLotActions(browse, {
    biddingOpen,
    currency: auction?.currency_code ?? "ZAR",
  });

  // Live prices for what any layout is showing, decided once rather than in each.
  useLotSubscription(
    browse.remaining
      .slice(0, SUBSCRIBE_AHEAD)
      .map((lot) => ({ id: lot.id, sequence: lot.bid_sequence })),
  );

  const preference = useBrowseLayoutPreference();
  const layout = useBrowseLayout();

  /*
   * `?at=<lot number>` is the gallery's hand-off to the stack.
   *
   * In the URL rather than in component state so the hardware back button
   * returns to the grid instead of leaving the auction, and so a tapped tile is
   * a place you can be sent back to. The preference stays "gallery" throughout:
   * this is a view the gallery is showing, not a change of layout.
   */
  const atParam = searchParams.get("at");
  const at = atParam === null ? null : Number(atParam);
  const openedAtLot = at !== null && Number.isFinite(at) ? at : null;
  const showingStack = layout === "stack" || openedAtLot !== null;

  const { openAt } = browse;
  useEffect(() => {
    openAt(openedAtLot);
  }, [openAt, openedAtLot]);

  if (error) {
    return (
      <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load this auction" />
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-(--app-width) items-center justify-between gap-3 px-4 pt-3 pb-2">
        {openedAtLot !== null ? (
          <button
            type="button"
            onClick={() => router.back()}
            className="flex min-h-11 items-center gap-1 text-sm text-text-muted hover:text-text"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Gallery
          </button>
        ) : (
          <Link href="/" className="flex min-h-11 items-center gap-1 text-sm text-text-muted hover:text-text">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Auctions
          </Link>
        )}

        {isPending || !auction ? (
          <Skeleton className="h-6 w-32" />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-medium">{auction.name}</h1>
            {auction.status === "live" ? (
              <StatusPill tone="live" pulse>
                <Countdown endsAt={auction.ends_at} />
              </StatusPill>
            ) : auction.status === "scheduled" ? (
              <StatusPill>
                <Countdown endsAt={auction.starts_at} prefix="Opens in" endedLabel="Opening…" />
              </StatusPill>
            ) : (
              <StatusPill>Ended</StatusPill>
            )}
          </div>
        )}
      </div>

      {auction ? (
        showingStack ? (
          <CardStack
            stack={browse}
            actions={actions}
            currency={auction.currency_code}
            biddingOpen={biddingOpen}
            opensAt={auction.status === "scheduled" ? auction.starts_at : undefined}
          />
        ) : layout === "list" ? (
          <LotList
            lots={browse.remaining}
            actions={actions}
            currency={auction.currency_code}
            biddingOpen={biddingOpen}
            isPending={browse.isPending}
            isFetchingMore={browse.isFetchingMore}
            hasMore={browse.hasMore}
            loadMore={browse.loadMore}
            canUndo={browse.canUndo}
          />
        ) : (
          <GalleryLayout
            auctionId={auctionId}
            lots={browse.remaining}
            currency={auction.currency_code}
            isPending={browse.isPending}
            isFetchingMore={browse.isFetchingMore}
            hasMore={browse.hasMore}
            loadMore={browse.loadMore}
            onOpenLot={(lot) => router.push(`?at=${lot.lot_number}`, { scroll: false })}
          />
        )
      ) : (
        <div className="mx-auto w-full max-w-(--app-width) px-4">
          <Skeleton className="h-[60dvh] w-full rounded-card" />
        </div>
      )}

      {/* One sheet for every layout: a right swipe and a list button are the same
          intent and must take the same path to the same confirm step. */}
      <BidSheet
        lot={actions.bidLot}
        currency={auction?.currency_code ?? "ZAR"}
        open={actions.bidLot !== null}
        onClose={actions.closeBidSheet}
      />

      {/* Owns the cancel window: its timer, its visibility rule, the request, and
          what happens to the swipe afterwards. One instance, because there is one
          pending bid. */}
      <PendingBidRunner onRaise={actions.openSheet} />

      {/* Asked here, not on the auction list: choosing between cards, rows and a
          grid means nothing until there are lots to picture in them. */}
      {preference === null ? <FirstRunLayoutChooser /> : null}
    </div>
  );
}

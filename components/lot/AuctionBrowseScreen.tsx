"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuction } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import { auctionDueAt, useDueRefresh } from "@/lib/hooks/useDueRefresh";
import { useAuctionBrowse } from "@/lib/hooks/useAuctionBrowse";
import { useLotActions } from "@/lib/hooks/useLotActions";
import { useLotSubscription } from "@/lib/hooks/useLotSubscription";
import { LotList } from "@/components/lot/LotList";
import { BidSheet } from "@/components/bid/BidSheet";
import { BidOutcomeSheet } from "@/components/bid/BidOutcomeSheet";
import { Countdown } from "@/components/ui/Countdown";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";

/** Lots kept subscribed: what's on screen plus a little ahead of it. */
const SUBSCRIBE_AHEAD = 12;

/**
 * One auction, browsed as a list.
 *
 * The list is the only layout. It used to be one of three — a card stack, a
 * photo gallery and this — chosen per device, with the stack as the default and
 * the product's identity. The first live stakeholder session found that too
 * complex, so the other two are gone and the preference with them.
 */
export function AuctionBrowseScreen({ auctionId }: { auctionId: string }) {
  const queryClient = useQueryClient();

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

  const browse = useAuctionBrowse(auctionId);
  const biddingOpen = auction?.status === "live";
  const actions = useLotActions();

  useLotSubscription(
    browse.lots
      .slice(0, SUBSCRIBE_AHEAD)
      .map((lot) => ({ id: lot.id, sequence: lot.bid_sequence })),
  );

  if (error) {
    return (
      <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load this auction" />
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-(--app-width) items-center justify-between gap-3 px-4 pt-3 pb-2">
        <Link href="/" className="flex min-h-11 items-center gap-1 text-sm text-text-muted hover:text-text">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Auctions
        </Link>

        {isPending || !auction ? (
          <Skeleton className="h-6 w-32" />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-medium">{auction.name}</h1>
            {auction.status === "live" ? (
              <StatusPill tone="live" pulse>
                <Countdown endsAt={auction.ends_at} plain />
              </StatusPill>
            ) : auction.status === "scheduled" ? (
              <StatusPill>
                <Countdown endsAt={auction.starts_at} prefix="Opens in" endedLabel="Opening…" plain />
              </StatusPill>
            ) : (
              <StatusPill>Ended</StatusPill>
            )}
          </div>
        )}
      </div>

      {auction ? (
        <LotList
          lots={browse.lots}
          actions={actions}
          currency={auction.currency_code}
          biddingOpen={biddingOpen}
          isPending={browse.isPending}
          isFetchingMore={browse.isFetchingMore}
          hasMore={browse.hasMore}
          loadMore={browse.loadMore}
        />
      ) : (
        <div className="mx-auto w-full max-w-(--app-width) px-4">
          <Skeleton className="h-[60dvh] w-full rounded-card" />
        </div>
      )}

      <BidSheet
        lot={actions.bidLot}
        currency={auction?.currency_code ?? "ZAR"}
        open={actions.bidLot !== null}
        onClose={actions.closeBidSheet}
      />

      {/* What a one-press bid landed on. Not a confirmation — the bid is already
          placed — but every refusal has something the user has to be told, and
          being outbid is where raising is offered. */}
      <BidOutcomeSheet
        state={actions.outcome}
        onClose={actions.clearOutcome}
        onRaise={actions.raiseFromOutcome}
      />
    </div>
  );
}

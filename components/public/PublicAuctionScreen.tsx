"use client";

import Link from "next/link";
import { usePublicAuction } from "@/lib/hooks/usePublicAuction";
import { wasSeen } from "@/lib/public/seen";
import { ApiError } from "@/lib/api/errors";
import { LotList } from "@/components/lot/LotList";
import { Countdown } from "@/components/ui/Countdown";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { GoneState } from "@/components/public/GoneState";

/**
 * One auction, read-only.
 *
 * The same list a member sees, minus the buttons: `LotList` takes `actions?` and
 * anonymous passes nothing, so the rows render **no controls at all** rather than
 * disabled ones. A disabled control is an invitation to work out how to enable it.
 */
export function PublicAuctionScreen({ auctionId }: { auctionId: string }) {
  const browse = usePublicAuction(auctionId);

  if (browse.error) {
    const status = browse.error instanceof ApiError ? browse.error.status : null;
    if (status === 404) {
      return wasSeen(auctionId) ? (
        <GoneState kind="auction" />
      ) : (
        <ErrorState
          error={browse.error}
          onRetry={browse.refetch}
          title="We couldn't find that auction"
        />
      );
    }
    return <ErrorState error={browse.error} onRetry={browse.refetch} title="Couldn't load this auction" />;
  }

  const auction = browse.auction;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-(--app-width) items-center justify-between gap-3 px-4 pt-3 pb-2">
        <Link href="/" className="flex min-h-11 items-center gap-1 text-sm text-text-muted hover:text-text">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Auctions
        </Link>

        {!auction ? (
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
          currency={auction.currency_code}
          biddingOpen={false}
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

      {browse.idle ? (
        <div className="mx-auto w-full max-w-(--app-width) px-4 pb-4">
          <button
            type="button"
            onClick={browse.resume}
            className="min-h-11 w-full rounded-full border border-border text-sm text-text-muted"
          >
            Prices paused — tap to resume
          </button>
        </div>
      ) : null}
    </div>
  );
}

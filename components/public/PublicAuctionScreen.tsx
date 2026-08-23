"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePublicAuction } from "@/lib/hooks/usePublicAuction";
import { useBrowseLayoutPreference } from "@/lib/browse/layoutPreference";
import { wasSeen } from "@/lib/public/seen";
import { ApiError } from "@/lib/api/errors";
import { GalleryLayout } from "@/components/lot/GalleryLayout";
import { LotList } from "@/components/lot/LotList";
import { Countdown } from "@/components/ui/Countdown";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { GoneState } from "@/components/public/GoneState";

/**
 * One auction, read-only.
 *
 * **Gallery and list only, defaulting to gallery.** The card stack is a decision
 * surface — drag, action row, undo, the exit animations — and stripping the
 * decisions out of it leaves a full-screen photo you cannot advance, with
 * `touch-none` stopping it scrolling. It would be the worst of the three photo
 * viewers. A stored preference of `stack` therefore falls back here **without
 * being overwritten**: it is still their preference for when they sign in.
 */
export function PublicAuctionScreen({ auctionId }: { auctionId: string }) {
  const router = useRouter();
  const browse = usePublicAuction(auctionId);
  const preference = useBrowseLayoutPreference();
  const layout = preference === "list" ? "list" : "gallery";

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
        layout === "list" ? (
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
          <GalleryLayout
            auctionId={auctionId}
            lots={browse.lots}
            currency={auction.currency_code}
            isPending={browse.isPending}
            isFetchingMore={browse.isFetchingMore}
            hasMore={browse.hasMore}
            loadMore={browse.loadMore}
            // A tile leads to the lot's own page — the canonical, shareable URL —
            // rather than into a stack this visitor cannot use.
            onOpenLot={(lot) => router.push(`/lots/${lot.id}`)}
          />
        )
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

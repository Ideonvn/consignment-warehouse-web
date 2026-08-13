"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuction } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import { auctionDueAt, useDueRefresh } from "@/lib/hooks/useDueRefresh";
import { CardStack } from "@/components/lot/CardStack";
import { Countdown } from "@/components/ui/Countdown";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";

export function AuctionStackScreen({ auctionId }: { auctionId: string }) {
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
        <CardStack
          auctionId={auctionId}
          currency={auction.currency_code}
          biddingOpen={auction.status === "live"}
          opensAt={auction.status === "scheduled" ? auction.starts_at : undefined}
        />
      ) : (
        <div className="mx-auto w-full max-w-(--app-width) px-4">
          <Skeleton className="h-[60dvh] w-full rounded-card" />
        </div>
      )}
    </div>
  );
}

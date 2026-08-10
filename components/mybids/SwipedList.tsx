"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { deleteSwipe, listAuctions } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import { useSwipedLots } from "@/lib/hooks/useSwipedLots";
import { useNow } from "@/lib/hooks/useTicker";
import { isLotOpen } from "@/lib/format/time";
import { lotOutcome } from "@/lib/format/lotStatus";
import type { LotCard, SwipeDirection } from "@/types/api";
import { BidSheet } from "@/components/bid/BidSheet";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LotImage } from "@/components/ui/LotImage";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

export function SwipedList({ direction }: { direction: SwipeDirection }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { lots, isPending, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSwipedLots(direction);
  const [bidTarget, setBidTarget] = useState<LotCard | null>(null);
  const now = useNow();

  // Swipes span auctions and the card carries no currency, so map it by auction.
  const { data: auctions } = useQuery({
    queryKey: queryKeys.auctions(),
    queryFn: () => listAuctions({ limit: 50 }),
  });
  const currencyFor = (auctionId: string) =>
    auctions?.find((auction) => auction.id === auctionId)?.currency_code ?? "ZAR";

  const unswipe = useMutation({
    mutationFn: (lotId: string) => deleteSwipe(lotId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["swiped"] });
      void queryClient.invalidateQueries({ queryKey: ["lots"] });
      showToast({
        title: direction === "pass" ? "Back in the stack" : "Removed from Interested",
        tone: "neutral",
      });
    },
    onError: () => showToast({ title: "Couldn't undo that swipe", tone: "danger" }),
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  if (lots.length === 0) {
    return (
      <EmptyState
        title={direction === "pass" ? "Nothing passed" : "Nothing saved yet"}
        description={
          direction === "pass"
            ? "Lots you swipe left on land here, in case you change your mind."
            : "Swipe right on a lot to save it here, even if you don't bid right away."
        }
        action={
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-ink"
          >
            Back to the stack
          </Link>
        }
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {lots.map((lot) => {
          const hasBids = lot.bid_count > 0 && lot.current_bid_minor !== null;
          const open = isLotOpen(lot.status, lot.effective_ends_at, now);
          return (
            <li
              key={lot.id}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <Link href={`/lots/${lot.id}`} className="flex gap-3 p-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                  <LotImage src={lot.primary_image_url} alt={lot.title} sizes="80px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{lot.title}</p>
                  <p className="mt-1 text-lg font-semibold text-accent">
                    <Money
                      minor={hasBids ? (lot.current_bid_minor ?? 0) : lot.starting_price_minor}
                      currency={currencyFor(lot.auction_id)}
                    />
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {open ? (
                      <Countdown endsAt={lot.effective_ends_at} prefix="Closes in" />
                    ) : (
                      (lotOutcome(lot.status, {
                        clockExpired: true,
                        hasBids: lot.bid_count > 0,
                      })?.label ?? "Closed")
                    )}
                  </p>
                </div>
              </Link>

              <div className="flex gap-2 border-t border-border p-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  loading={unswipe.isPending && unswipe.variables === lot.id}
                  onClick={() => unswipe.mutate(lot.id)}
                >
                  {direction === "pass" ? "Un-pass" : "Remove"}
                </Button>
                {open ? (
                  <Button className="flex-1" onClick={() => setBidTarget(lot)}>
                    Bid
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {hasNextPage ? (
        <Button
          variant="ghost"
          fullWidth
          className="mt-3"
          loading={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          Show more
        </Button>
      ) : null}

      <BidSheet
        lot={bidTarget}
        currency={bidTarget ? currencyFor(bidTarget.auction_id) : "ZAR"}
        open={bidTarget !== null}
        onClose={() => setBidTarget(null)}
      />
    </>
  );
}

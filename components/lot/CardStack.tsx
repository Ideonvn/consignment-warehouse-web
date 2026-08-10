"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import type { LotCard, SwipeDirection } from "@/types/api";
import { useLotStack } from "@/lib/hooks/useLotStack";
import { useLotSubscription } from "@/lib/hooks/useLotSubscription";
import { LotCardFace } from "@/components/lot/LotCardFace";
import { SwipeCard } from "@/components/lot/SwipeCard";
import { BidSheet } from "@/components/bid/BidSheet";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

/** Cards rendered behind the top one, so the stack reads as a stack. */
const DEPTH = 3;
/** Lots kept subscribed: the visible ones plus the next few. */
const SUBSCRIBE_AHEAD = 8;

export function CardStack({
  auctionId,
  currency,
}: {
  auctionId: string;
  currency: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const onStackError = useCallback(
    (message: string) => showToast({ title: message, tone: "danger" }),
    [showToast],
  );

  const stack = useLotStack(auctionId, onStackError);
  const [exitDirection, setExitDirection] = useState<SwipeDirection>("pass");
  const [bidLot, setBidLot] = useState<LotCard | null>(null);
  const busy = useRef(false);

  const decide = useCallback(
    (lot: LotCard, direction: SwipeDirection) => {
      if (busy.current) return;
      busy.current = true;
      setExitDirection(direction);

      // A swipe right records intent; only the sheet takes money.
      if (direction === "interested") setBidLot(lot);

      void stack.decide(lot, direction).finally(() => {
        busy.current = false;
      });
    },
    [stack],
  );

  const undo = useCallback(() => {
    void stack.undo().then((restored) => {
      if (restored) showToast({ title: `Lot ${restored.lot_number} is back`, tone: "neutral" });
    });
  }, [stack, showToast]);

  const top = stack.cards[0] ?? null;
  const behind = stack.cards.slice(1, DEPTH);

  // Live updates for what's on screen and just behind it, nothing more.
  useLotSubscription(
    stack.cards
      .slice(0, SUBSCRIBE_AHEAD)
      .map((lot) => ({ id: lot.id, sequence: lot.bid_sequence })),
  );

  if (stack.isPending) return <StackSkeleton />;
  if (stack.error && stack.cards.length === 0) {
    return <ErrorState error={stack.error} onRetry={stack.refetch} title="Couldn't load lots" />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <div
        role="group"
        aria-label="Lot stack. Use the left and right arrow keys to pass or bid."
        tabIndex={0}
        onKeyDown={(event) => {
          if (!top) return;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            decide(top, "pass");
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            decide(top, "interested");
          }
        }}
        className="relative mx-auto w-full max-w-(--app-width) flex-1 px-4"
      >
        <div className="relative h-[min(68dvh,34rem)] w-full">
          {top ? (
            <>
              {behind
                .map((lot, index) => (
                  <div
                    key={lot.id}
                    aria-hidden
                    className="absolute inset-0 origin-bottom"
                    style={{
                      transform: `scale(${1 - (index + 1) * 0.04}) translateY(${(index + 1) * -10}px)`,
                      opacity: 1 - (index + 1) * 0.25,
                      zIndex: -index - 1,
                    }}
                  >
                    <LotCardFace lot={lot} currency={currency} />
                  </div>
                ))
                .reverse()}

              <AnimatePresence custom={exitDirection} initial={false}>
                <SwipeCard
                  key={top.id}
                  lot={top}
                  currency={currency}
                  onDecide={(direction) => decide(top, direction)}
                  onOpen={() => router.push(`/lots/${top.id}`)}
                />
              </AnimatePresence>
            </>
          ) : stack.isFetchingMore ? (
            <Skeleton className="h-full w-full rounded-card" />
          ) : (
            <EmptyState
              title="That's every lot"
              description="You've been through the whole stack. Changed your mind about one?"
              action={
                <Link
                  href="/my-bids?view=passed"
                  className="inline-flex min-h-11 items-center rounded-full border border-accent-edge bg-accent px-5 font-semibold text-accent-ink"
                >
                  See what you passed
                </Link>
              }
            />
          )}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-(--app-width) items-center justify-center gap-3 px-4 py-5">
        <Button
          variant="secondary"
          size="lg"
          aria-label="Pass on this lot"
          disabled={!top}
          onClick={() => top && decide(top, "pass")}
          className="h-14 w-14 shrink-0 !px-0"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </Button>

        <Button
          variant="ghost"
          aria-label="Undo the last swipe"
          disabled={!stack.canUndo}
          onClick={undo}
        >
          Undo
        </Button>

        <Button
          size="lg"
          aria-label="Bid on this lot"
          disabled={!top}
          onClick={() => top && decide(top, "interested")}
          className="h-14 w-14 shrink-0 !px-0"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 13l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Button>
      </div>

      <BidSheet
        lot={bidLot}
        currency={currency}
        open={bidLot !== null}
        onClose={() => setBidLot(null)}
      />
    </div>
  );
}

function StackSkeleton() {
  return (
    <div className="mx-auto w-full max-w-(--app-width) flex-1 px-4">
      <Skeleton className="h-[min(68dvh,34rem)] w-full rounded-card" />
      <div className="mt-5 flex justify-center gap-3">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="h-11 w-20 rounded-full" />
        <Skeleton className="h-14 w-14 rounded-full" />
      </div>
    </div>
  );
}

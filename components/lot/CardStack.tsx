"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import type { LotCard, SwipeDirection } from "@/types/api";
import { useLotStack } from "@/lib/hooks/useLotStack";
import { useLotSubscription } from "@/lib/hooks/useLotSubscription";
import { LotCardFace } from "@/components/lot/LotCardFace";
import { SwipeCard, type CardExit } from "@/components/lot/SwipeCard";
import { BidSheet } from "@/components/bid/BidSheet";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Countdown } from "@/components/ui/Countdown";

/** Cards rendered behind the top one, so the stack reads as a stack. */
const DEPTH = 3;
/** Lots kept subscribed: the visible ones plus the next few. */
const SUBSCRIBE_AHEAD = 8;

export function CardStack({
  auctionId,
  currency,
  biddingOpen,
  opensAt,
}: {
  auctionId: string;
  currency: string;
  /** False before the auction opens: browse and save, but no money moves. */
  biddingOpen: boolean;
  opensAt?: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const onStackError = useCallback(
    (message: string) => showToast({ title: message, tone: "danger" }),
    [showToast],
  );

  const stack = useLotStack(auctionId, onStackError);
  const [exitDirection, setExitDirection] = useState<CardExit>("pass");
  const [bidLot, setBidLot] = useState<LotCard | null>(null);
  const busy = useRef(false);

  const decide = useCallback(
    (lot: LotCard, direction: SwipeDirection) => {
      if (busy.current) return;
      busy.current = true;
      setExitDirection(direction);

      // A swipe right records intent; only the sheet takes money. Before the
      // auction opens there is no sheet to show — the interest is still saved.
      if (direction === "interested") {
        if (biddingOpen) {
          setBidLot(lot);
        } else {
          showToast({
            title: "Saved to Interested",
            description: "Bidding hasn't opened on this auction yet — we'll keep it for you.",
            tone: "neutral",
          });
        }
      }

      void stack.decide(lot, direction).finally(() => {
        busy.current = false;
      });
    },
    [stack, biddingOpen, showToast],
  );

  /** Not a decision: the card goes to the back and nothing is recorded. */
  const skip = useCallback(
    (lot: LotCard) => {
      if (busy.current) return;
      setExitDirection("skip");
      stack.skip(lot);
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
      {!biddingOpen && opensAt ? (
        <p className="mx-auto mb-1 w-full max-w-(--app-width) rounded-2xl border border-border bg-surface-raised px-4 py-2 text-center text-xs text-text-muted">
          Bidding opens in{" "}
          <Countdown endsAt={opensAt} className="font-semibold text-text" endedLabel="a moment" />.
          Look through now and save anything you like.
        </p>
      ) : null}

      <div
        role="group"
        aria-label={
          biddingOpen
            ? "Lot stack. Left arrow passes, right arrow bids, up arrow skips, down arrow undoes."
            : "Lot stack. Left arrow passes, right arrow saves, up arrow skips, down arrow undoes."
        }
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            undo();
            return;
          }
          if (!top) return;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            decide(top, "pass");
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            decide(top, "interested");
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            skip(top);
          }
        }}
        className="relative mx-auto flex w-full max-w-(--app-width) min-h-0 flex-1 flex-col px-4"
      >
        {/* Photos are the point of this screen, so the card takes whatever is
            left and shrinks when space is short — the buttons never do. */}
        <div className="relative min-h-0 w-full flex-1 md:max-h-[34rem]">
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
                  onSkip={() => skip(top)}
                  onUndo={undo}
                  canUndo={stack.canUndo}
                  bidLabel={biddingOpen ? "Bid" : "Save"}
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

      {/* Anchored to the nav, not to the end of the content: on a short viewport
          it overlaps the card's padded dead space rather than being pushed under
          the nav. The scrim keeps it legible over a pale photograph. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-20">
        <div className="mx-auto w-full max-w-(--app-width) bg-gradient-to-t from-bg via-bg/90 to-transparent px-4 pt-10 pb-3">
          <div className="pointer-events-auto relative flex items-center justify-center gap-5">
            {/* Undo sits out of the centred group so the three targets keep
                their spacing — crowding them is how someone passes on a lot they
                meant to bid on. */}
            <div className="absolute left-0">
              <Button
                variant="ghost"
                aria-label="Undo the last swipe"
                disabled={!stack.canUndo}
                onClick={undo}
              >
                Undo
              </Button>
            </div>

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
            variant="secondary"
            aria-label="Skip this lot for now"
            disabled={!top}
            onClick={() => top && skip(top)}
            className="h-12 w-12 shrink-0 !px-0"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>

          <Button
            size="lg"
            aria-label={biddingOpen ? "Bid on this lot" : "Save this lot as interested"}
            disabled={!top}
            onClick={() => top && decide(top, "interested")}
            className="h-14 w-14 shrink-0 !px-0"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 13l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
          </div>
        </div>
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
      <Skeleton className="h-[60dvh] w-full rounded-card" />
      <div className="mt-5 flex justify-center gap-3">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="h-11 w-20 rounded-full" />
        <Skeleton className="h-14 w-14 rounded-full" />
      </div>
    </div>
  );
}

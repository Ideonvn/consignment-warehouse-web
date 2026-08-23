"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useNow } from "@/lib/hooks/useTicker";
import { isLotOpen } from "@/lib/format/time";
import { useMyBidStatus, type MyBidStatus } from "@/lib/hooks/useMyBidStatus";
import { useLoadMoreOnScroll } from "@/lib/hooks/useLoadMoreOnScroll";
import type { AuctionBrowse } from "@/lib/hooks/useAuctionBrowse";
import type { LotActions } from "@/lib/hooks/useLotActions";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { LotImage } from "@/components/ui/LotImage";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";
import type { LotCard } from "@/types/api";

/**
 * How long a resolved row keeps its space before the list closes up.
 *
 * This is the mis-tap guard, and it is a **timer, not an animation**. A row
 * vanishing under a finger drops whatever was below it into the same pixels, and
 * on a list the next thing down is another lot's Pass button. Holding the space
 * means the tap that was already on its way lands on nothing.
 *
 * Deliberately not conditioned on `prefers-reduced-motion`: dropping the
 * animation must not drop the protection, so reduced motion loses the collapse
 * and keeps the delay.
 */
const HOLD_MS = 320;

export function LotList({
  browse,
  actions,
  currency,
  biddingOpen,
}: {
  browse: AuctionBrowse;
  actions: LotActions;
  currency: string;
  biddingOpen: boolean;
}) {
  const { statusFor, truncated } = useMyBidStatus();
  const sentinel = useLoadMoreOnScroll(browse.hasMore, browse.loadMore);
  /*
   * Snapshots of rows that have been actioned but are still holding their space.
   *
   * They have to be snapshots: `decide` removes the lot from `browse.remaining`
   * immediately — that optimism is what makes the action feel instant — so by
   * the time this renders there is no live lot left to hold a space for.
   */
  const [leaving, setLeaving] = useState<LotCard[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  function hold(lot: LotCard, direction: "pass" | "interested") {
    setLeaving((current) =>
      current.some((held) => held.id === lot.id) ? current : [...current, lot],
    );
    // A row leaving is invisible to a screen reader; the toast only covers some
    // of these paths, so the list says what happened itself.
    setAnnouncement(
      direction === "pass" ? `Lot ${lot.lot_number} passed` : `Lot ${lot.lot_number} saved`,
    );
    const timer = setTimeout(() => {
      setLeaving((current) => current.filter((held) => held.id !== lot.id));
      timers.current.delete(lot.id);
    }, HOLD_MS);
    timers.current.set(lot.id, timer);
  }

  if (browse.isPending) return <ListSkeleton />;

  const liveIds = new Set(browse.remaining.map((lot) => lot.id));
  // An undo inside the hold window puts the lot back in the set; the held ghost
  // is dropped rather than rendered alongside the real row.
  const held = leaving.filter((lot) => !liveIds.has(lot.id));
  const heldIds = new Set(held.map((lot) => lot.id));
  const rows = [...browse.remaining, ...held].sort((a, b) => a.lot_number - b.lot_number);

  if (rows.length === 0) {
    return (
      <div className="mx-auto w-full max-w-(--app-width) px-4 pb-8">
        <EmptyState
          title="That's every lot"
          description="You've been through the whole auction. Changed your mind about one?"
          action={
            <Link
              href="/my-bids?view=passed"
              className="inline-flex min-h-11 items-center rounded-full border border-accent-edge bg-accent px-5 font-semibold text-accent-ink"
            >
              See what you passed
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-(--app-width) px-4 pb-8">
      {/* Sticky, not fixed: this list scrolls, so an undo pinned over the bottom
          nav would fight the content. Undo has to be visible here — a one-tap
          destructive action with no way back is how someone loses a lot. */}
      <div className="sticky top-0 z-10 -mx-4 mb-2 flex items-center justify-between gap-3 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur">
        <p className="text-xs text-text-muted">
          {browse.remaining.length} {browse.remaining.length === 1 ? "lot" : "lots"} left
        </p>
        <Button variant="ghost" disabled={!browse.canUndo} onClick={actions.undo}>
          Undo
        </Button>
      </div>

      {truncated ? (
        <p className="mb-2 rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs text-text-muted">
          You have more bids than we can list at once, so some rows can&apos;t show whether
          you&apos;re winning. Open a lot to see for certain.
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {rows.map((lot) => (
          <li key={lot.id}>
            <LotRow
              lot={lot}
              currency={currency}
              biddingOpen={biddingOpen}
              bidStatus={statusFor(lot.id)}
              leaving={heldIds.has(lot.id)}
              onDecide={(direction) => {
                hold(lot, direction);
                actions.decide(lot, direction);
              }}
            />
          </li>
        ))}
      </ul>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div ref={sentinel} aria-hidden className="h-px" />
      {browse.isFetchingMore ? <Skeleton className="mt-2 h-24 w-full rounded-2xl" /> : null}
    </div>
  );
}

const BID_STATUS: Record<MyBidStatus, { label: string; className: string } | null> = {
  leading: { label: "Winning", className: "text-success" },
  outbid: { label: "Outbid", className: "text-danger" },
  // Nothing to say: no bid is the ordinary case and needs no badge.
  none: null,
  // Distinct from `none` on purpose — see `useMyBidStatus`.
  unknown: { label: "Bid status unknown", className: "text-text-muted" },
};

function LotRow({
  lot,
  currency,
  biddingOpen,
  bidStatus,
  leaving,
  onDecide,
}: {
  lot: LotCard;
  currency: string;
  biddingOpen: boolean;
  bidStatus: MyBidStatus;
  leaving: boolean;
  onDecide: (direction: "pass" | "interested") => void;
}) {
  const now = useNow();
  const open = isLotOpen(lot.status, lot.effective_ends_at, now);
  const hasBids = lot.current_bid_minor !== null && lot.bid_count > 0;
  const status = BID_STATUS[bidStatus];

  return (
    <article
      // The row is inert the instant it is actioned, so the space it is holding
      // cannot be tapped and a double tap cannot fire twice.
      aria-hidden={leaving || undefined}
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-surface transition-[opacity,transform] duration-300 motion-reduce:transition-none",
        leaving && "pointer-events-none scale-[0.98] opacity-40",
      )}
    >
      <Link href={`/lots/${lot.id}`} className="flex gap-3 p-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
          <LotImage src={lot.primary_image_url} alt={lot.title} sizes="80px" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold">{lot.title}</p>
            {status ? (
              <span className={cn("shrink-0 text-xs font-semibold", status.className)}>
                {status.label}
              </span>
            ) : null}
          </div>

          <p className="mt-0.5 text-xs text-text-muted">Lot {lot.lot_number}</p>

          <p className="tabular mt-1 text-base font-semibold">
            <Money minor={hasBids ? (lot.current_bid_minor ?? 0) : lot.starting_price_minor} currency={currency} />
            <span className="ml-1 text-xs font-normal text-text-muted">
              {hasBids ? `· ${lot.bid_count} ${lot.bid_count === 1 ? "bid" : "bids"}` : "· no bids yet"}
            </span>
          </p>

          <p className="mt-0.5 text-xs text-text-muted">
            {open ? (
              <Countdown endsAt={lot.effective_ends_at} prefix="Closes in" />
            ) : lot.status === "scheduled" ? (
              "Not open yet"
            ) : (
              "Bidding closed"
            )}
          </p>
        </div>
      </Link>

      <div className="flex gap-2 border-t border-border px-3 py-2">
        <Button
          variant="secondary"
          aria-label={`Pass on lot ${lot.lot_number}, ${lot.title}`}
          disabled={leaving}
          onClick={() => onDecide("pass")}
          className="flex-1"
        >
          Pass
        </Button>
        <Button
          aria-label={
            biddingOpen && open
              ? `Bid on lot ${lot.lot_number}, ${lot.title}`
              : `Save lot ${lot.lot_number}, ${lot.title}, as interested`
          }
          disabled={leaving}
          onClick={() => onDecide("interested")}
          className="flex-1"
        >
          {/* Never "Bid" as a completed act: this opens the sheet, and money
              moves only on confirm there. */}
          {biddingOpen && open ? "Bid" : "Interested"}
        </Button>
      </div>
    </article>
  );
}

function ListSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-(--app-width) flex-col gap-2 px-4">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-36 w-full rounded-2xl" />
      ))}
    </div>
  );
}

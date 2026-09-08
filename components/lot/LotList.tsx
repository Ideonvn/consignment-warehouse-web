"use client";

import Link from "next/link";
import { useNow } from "@/lib/hooks/useTicker";
import { isLotOpen } from "@/lib/format/time";
import { useMyBidStatus, type MyBidStatus } from "@/lib/hooks/useMyBidStatus";
import { useLoadMoreOnScroll } from "@/lib/hooks/useLoadMoreOnScroll";
import type { LotActions } from "@/lib/hooks/useLotActions";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { LotImage } from "@/components/ui/LotImage";
import { Money } from "@/components/ui/Money";
import { formatMoney } from "@/lib/format/money";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";
import type { LotCard, LotSummary } from "@/types/api";

/**
 * The auction, and the whole product.
 *
 * Two buttons a row: the most you'll pay, and bid this amount now. **There is no
 * pass** — passing was half of a swipe model that no longer exists — and nothing
 * ever leaves this list because of something the user did. A lot goes when it
 * ends, and that is the only reason.
 */
export function LotList({
  lots,
  actions,
  currency,
  biddingOpen,
  isPending,
  isFetchingMore,
  hasMore,
  loadMore,
}: {
  lots: LotSummary[];
  /**
   * Absent for an anonymous visitor, which is how this list has **no action
   * buttons at all** rather than disabled ones. A disabled control is an
   * invitation to work out how to enable it; absence is honest.
   */
  actions?: LotActions;
  currency: string;
  biddingOpen: boolean;
  isPending: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
}) {
  const { statusFor, truncated } = useMyBidStatus(Boolean(actions));
  const sentinel = useLoadMoreOnScroll(hasMore, loadMore);

  if (isPending) return <ListSkeleton />;

  if (lots.length === 0) {
    return (
      <div className="mx-auto w-full max-w-(--app-width) px-4 pb-8">
        <EmptyState
          title="Nothing here yet"
          description="This auction has no lots to show right now."
          action={
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-full border border-accent-edge bg-accent px-5 font-semibold text-accent-ink"
            >
              Back to auctions
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-(--app-width) px-4 pb-8">
      <p className="py-2 text-xs text-text-muted">
        {lots.length} {lots.length === 1 ? "lot" : "lots"}
      </p>

      {truncated ? (
        <p className="mb-2 rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs text-text-muted">
          You have more bids than we can list at once, so some rows can&apos;t show whether
          you&apos;re winning. Open a lot to see for certain.
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {lots.map((lot) => (
          <li key={lot.id}>
            <LotRow
              lot={lot}
              currency={currency}
              biddingOpen={biddingOpen}
              bidStatus={statusFor(lot.id)}
              actions={actions}
            />
          </li>
        ))}
      </ul>

      <div ref={sentinel} aria-hidden className="h-px" />
      {isFetchingMore ? <Skeleton className="mt-2 h-24 w-full rounded-2xl" /> : null}
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

/**
 * `my_auto_bid_max_minor` is on the *member* card shape only, so this reads it
 * structurally rather than widening `LotSummary` — which both the member and the
 * public card have to satisfy. An anonymous row has no buttons anyway.
 */
function autoBidMax(lot: LotSummary): number | null {
  return (lot as Partial<LotCard>).my_auto_bid_max_minor ?? null;
}

function LotRow({
  lot,
  currency,
  biddingOpen,
  bidStatus,
  actions,
}: {
  lot: LotSummary;
  currency: string;
  biddingOpen: boolean;
  bidStatus: MyBidStatus;
  /** Absent for an anonymous visitor: the row then has no buttons at all. */
  actions?: LotActions;
}) {
  const now = useNow();
  const open = isLotOpen(lot.status, lot.effective_ends_at, now);
  const hasBids = lot.current_bid_minor !== null && lot.bid_count > 0;
  const status = BID_STATUS[bidStatus];
  const hasMax = autoBidMax(lot) !== null;
  const canBid = Boolean(actions) && biddingOpen && open;
  const submitting = actions?.isSubmitting(lot.id) ?? false;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface">
      <Link href={`/lots/${lot.id}`} className="flex gap-3 p-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
          <LotImage src={lot.primary_image_url} alt={lot.title} sizes="80px" />
        </div>

        <div className="min-w-0 flex-1">
          {/*
           * The lot number, top-right and large.
           *
           * Testers could not find it when it was a muted line under the title,
           * and it is how people refer to lots out loud and in messages — so it
           * is the second thing you see after the photograph. It sits in the
           * space the title already leaves, on the same first line, so the row
           * does not get taller: the title truncates instead.
           */}
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold">{lot.title}</p>
            <p className="tabular shrink-0 text-xl leading-none font-bold">
              <span className="sr-only">Lot </span>
              {lot.lot_number}
            </p>
          </div>

          <p className="tabular mt-1 text-base font-semibold">
            <Money minor={hasBids ? (lot.current_bid_minor ?? 0) : lot.starting_price_minor} currency={currency} />
            <span className="ml-1 text-xs font-normal text-text-muted">
              {hasBids ? `· ${lot.bid_count} ${lot.bid_count === 1 ? "bid" : "bids"}` : "· no bids yet"}
            </span>
          </p>

          {/* `min-h-6` reserves the final-minute alarm's height up front, so a lot
              crossing into its last minute changes no layout and cannot push the
              buttons below it off a short screen. */}
          <div className="mt-1 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
            {open ? (
              <Countdown endsAt={lot.effective_ends_at} prefix="Closes in" />
            ) : lot.status === "scheduled" ? (
              <span>Not open yet</span>
            ) : (
              <span>Bidding closed</span>
            )}
            {status ? (
              <span className={cn("font-semibold", status.className)}>{status.label}</span>
            ) : null}
          </div>
        </div>
      </Link>

      {actions ? (
        <div className="flex gap-2 border-t border-border px-3 py-2">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={!canBid}
            onClick={() => actions.openSheet(lot)}
            aria-label={`${hasMax ? "Raise" : "Enter"} your maximum on lot ${lot.lot_number}, ${lot.title}`}
          >
            {hasMax ? "Raise Maximum" : "Enter Maximum"}
          </Button>
          {/*
           * Pressing this places the bid. No sheet, no confirmation, no delay —
           * so the amount has to be on the button itself, and it is the server's
           * own `minimum_next_bid_minor`, never a figure computed here.
           */}
          <Button
            className="flex-1"
            disabled={!canBid}
            loading={submitting}
            onClick={() => actions.bidNow(lot, currency)}
            aria-label={`Bid ${formatMoney(lot.minimum_next_bid_minor, currency)} on lot ${lot.lot_number}, ${lot.title}`}
          >
            Bid <Money minor={lot.minimum_next_bid_minor} currency={currency} />
          </Button>
        </div>
      ) : null}
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

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listAuctions, listMyBids } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import { useLotSubscription } from "@/lib/hooks/useLotSubscription";
import { useNow } from "@/lib/hooks/useTicker";
import { isLotOpen } from "@/lib/format/time";
import type { MyBid } from "@/types/api";
import { BidSheet, type BidTarget } from "@/components/bid/BidSheet";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LotImage } from "@/components/ui/LotImage";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";

type Group = { key: string; title: string; rows: MyBid[] };

function toBidTarget(row: MyBid): BidTarget {
  return {
    id: row.lot_id,
    title: row.title,
    primary_image_url: row.primary_image_url,
    current_bid_minor: row.current_bid_minor,
    minimum_next_bid_minor: row.minimum_next_bid_minor,
    starting_price_minor: row.current_bid_minor ?? row.minimum_next_bid_minor,
    bid_count: 1,
    effective_ends_at: row.effective_ends_at,
  };
}

export function BiddingList() {
  const [openOnly, setOpenOnly] = useState(false);
  const [raiseTarget, setRaiseTarget] = useState<MyBid | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: queryKeys.myBids(openOnly),
    queryFn: () => listMyBids({ active_only: openOnly, limit: 50 }),
  });

  const { data: auctions } = useQuery({
    queryKey: queryKeys.auctions(),
    queryFn: () => listAuctions({ limit: 50 }),
  });

  const now = useNow();

  // The 200-lot cap is far above any realistic "my bids" list.
  useLotSubscription((data ?? []).filter((row) => row.is_open).map((row) => row.lot_id));

  const currencyFor = (auctionId: string) =>
    auctions?.find((auction) => auction.id === auctionId)?.currency_code ?? "ZAR";

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load your bids" />;
  }

  const rows = (data ?? []).map((row) => ({
    ...row,
    // `is_open` can lag the clock; the countdown is the honest signal.
    is_open: row.is_open && isLotOpen(row.status, row.effective_ends_at, now),
  }));
  const groups: Group[] = [
    { key: "winning", title: "Winning", rows: rows.filter((row) => row.is_open && row.am_i_leading) },
    { key: "outbid", title: "Outbid", rows: rows.filter((row) => row.is_open && !row.am_i_leading) },
    { key: "ended", title: "Ended", rows: rows.filter((row) => !row.is_open) },
  ].filter((group) => group.rows.length > 0);

  return (
    <div>
      <label className="mb-4 flex items-center gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          checked={openOnly}
          onChange={(event) => setOpenOnly(event.target.checked)}
          className="h-5 w-5 accent-[var(--color-accent)]"
        />
        Only lots still open
      </label>

      {rows.length === 0 ? (
        <EmptyState
          title="No bids yet"
          description="Swipe right on a lot you want and set your maximum. We'll bid for you."
          action={
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-ink"
            >
              Find something
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-2 text-sm font-semibold tracking-wide text-text-muted uppercase">
                {group.title} · {group.rows.length}
              </h2>
              <ul className="flex flex-col gap-3">
                {group.rows.map((row) => (
                  <li key={row.lot_id}>
                    <BidRow
                      row={row}
                      currency={currencyFor(row.auction_id)}
                      onRaise={() => setRaiseTarget(row)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <BidSheet
        lot={raiseTarget ? toBidTarget(raiseTarget) : null}
        currency={raiseTarget ? currencyFor(raiseTarget.auction_id) : "ZAR"}
        open={raiseTarget !== null}
        onClose={() => setRaiseTarget(null)}
      />
    </div>
  );
}

function BidRow({
  row,
  currency,
  onRaise,
}: {
  row: MyBid;
  currency: string;
  onRaise: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface">
      <Link href={`/lots/${row.lot_id}`} className="flex gap-3 p-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
          <LotImage src={row.primary_image_url} alt={row.title} sizes="80px" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold">{row.title}</p>
            <span
              className={cn(
                "shrink-0 text-xs font-semibold",
                !row.is_open ? "text-text-muted"
                : row.am_i_leading ? "text-success"
                : "text-danger",
              )}
            >
              {!row.is_open ? (row.am_i_leading ? "Won" : "Ended") : row.am_i_leading ? "Winning" : "Outbid"}
            </span>
          </div>

          <p className="mt-1 text-lg font-semibold text-accent">
            <Money minor={row.current_bid_minor ?? 0} currency={currency} />
          </p>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-text-muted">
            {row.my_max_minor !== null ? (
              <span>
                Your max <Money minor={row.my_max_minor} currency={currency} />
              </span>
            ) : null}
            {row.is_open ? (
              <Countdown endsAt={row.effective_ends_at} prefix="Closes in" />
            ) : (
              <span>Closed</span>
            )}
          </div>
        </div>
      </Link>

      {row.is_open && !row.am_i_leading ? (
        <div className="border-t border-border p-3 pt-2">
          <Button
            fullWidth
            onClick={onRaise}
            aria-label={`Raise your maximum on ${row.title}`}
          >
            Raise my maximum
          </Button>
        </div>
      ) : null}
    </article>
  );
}

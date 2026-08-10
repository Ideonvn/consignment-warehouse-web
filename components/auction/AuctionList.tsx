"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listAuctions } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import type { Auction } from "@/types/api";
import { Countdown } from "@/components/ui/Countdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LotImage } from "@/components/ui/LotImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { useSession } from "@/lib/auth/session";

/** Live first — that's where money can actually change hands. */
const ORDER: Record<Auction["status"], number> = {
  live: 0,
  scheduled: 1,
  ended: 2,
  settled: 3,
  cancelled: 4,
  draft: 5,
};

export function AuctionList() {
  const firstName = useSession((state) => state.user?.first_name);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: queryKeys.auctions(),
    queryFn: () => listAuctions({ limit: 50 }),
  });

  const auctions = [...(data ?? [])].sort(
    (a, b) =>
      ORDER[a.status] - ORDER[b.status] || Date.parse(a.ends_at) - Date.parse(b.ends_at),
  );

  return (
    <PhoneColumn className="pb-8">
      <ScreenHeader
        title={firstName ? `Hi, ${firstName}` : "Auctions"}
        subtitle="Swipe through the lots. Right to bid, left to pass."
      />

      {isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-52 w-full rounded-card" />
          <Skeleton className="h-52 w-full rounded-card" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load auctions" />
      ) : auctions.length === 0 ? (
        <EmptyState
          title="No auctions yet"
          description="Nothing is running right now. Check back soon — new consignments land every week."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {auctions.map((auction) => (
            <li key={auction.id}>
              <AuctionCard auction={auction} />
            </li>
          ))}
        </ul>
      )}
    </PhoneColumn>
  );
}

function AuctionCard({ auction }: { auction: Auction }) {
  const isLive = auction.status === "live";
  const isScheduled = auction.status === "scheduled";
  const enterable = isLive || auction.status === "ended" || auction.status === "settled";

  const body = (
    <article className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="relative aspect-[16/9] w-full">
        <LotImage src={auction.image_url} alt={auction.name} />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface to-transparent" />
        <div className="absolute top-3 left-3">
          {isLive ? (
            <StatusPill tone="live" pulse>
              Live
            </StatusPill>
          ) : isScheduled ? (
            <StatusPill>Opens soon</StatusPill>
          ) : (
            <StatusPill>{auction.status === "cancelled" ? "Cancelled" : "Ended"}</StatusPill>
          )}
        </div>
      </div>

      <div className="p-4">
        <h2 className="text-lg font-semibold">{auction.name}</h2>
        {auction.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-text-muted">{auction.description}</p>
        ) : null}

        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-text-muted">
            <span className="tabular">
              {auction.lot_count} lot{auction.lot_count === 1 ? "" : "s"}
            </span>
            <span aria-hidden>·</span>
            {isScheduled ? (
              <Countdown endsAt={auction.starts_at} prefix="Opens in" endedLabel="Opening…" />
            ) : isLive ? (
              <Countdown endsAt={auction.ends_at} prefix="Closes in" endedLabel="Closing…" />
            ) : (
              "Closed"
            )}
          </span>
          {enterable ? (
            <span className="font-semibold text-accent-text">
              {isLive ? "Enter stack →" : "View lots →"}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );

  if (!enterable) {
    return <div aria-disabled className="opacity-60">{body}</div>;
  }

  return (
    <Link href={`/auctions/${auction.id}`} className="block rounded-card">
      {body}
    </Link>
  );
}

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listPublicAuctions } from "@/lib/api/publicEndpoints";
import { AuctionSections } from "@/components/auction/AuctionSections";
import { Countdown } from "@/components/ui/Countdown";
import { ErrorState } from "@/components/ui/ErrorState";
import { LotImage } from "@/components/ui/LotImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { Wordmark } from "@/components/layout/Wordmark";
import type { PublicAuction } from "@/types/api";

/** Live first — that is where something is actually happening. */
const ORDER: Record<string, number> = { live: 0, scheduled: 1, ended: 2, settled: 3, cancelled: 4 };

/** What a stranger sees at the apex: the public catalogue, and one way in. */
export function PublicAuctionList() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["public", "auctions"],
    queryFn: () => listPublicAuctions({ limit: 50 }),
  });

  if (error) {
    return <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load auctions" />;
  }

  const auctions = [...(data ?? [])].sort(
    (a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9),
  );

  return (
    <PhoneColumn className="pb-8">
      <Wordmark className="mt-2 mb-6" />
      <h1 className="text-2xl font-semibold tracking-tight">What&apos;s on</h1>
      <p className="mt-1 text-sm text-text-muted">
        Browse every lot — photos, prices and the clock. An account is only needed to bid.
      </p>

      {isPending ? (
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-32 w-full rounded-card" />
          <Skeleton className="h-32 w-full rounded-card" />
        </div>
      ) : (
        <AuctionSections
          className="mt-6"
          auctions={auctions}
          renderCard={(auction) => <PublicAuctionCard auction={auction} />}
          empty={{
            title: "Nothing public right now",
            description: "There's no auction open to the public at the moment. Check back soon.",
          }}
          emptyWithFinished={{
            title: "Nothing open right now",
            description:
              "There's no auction open to the public at the moment. Check back soon — meanwhile, see how the last one went.",
          }}
        />
      )}
    </PhoneColumn>
  );
}

function PublicAuctionCard({ auction }: { auction: PublicAuction }) {
  return (
    <Link
      href={`/auctions/${auction.id}`}
      className="block overflow-hidden rounded-card border border-border bg-surface"
    >
      <div className="relative h-32 w-full">
        <LotImage src={auction.image_url} alt={auction.name} sizes="(min-width: 448px) 448px, 100vw" />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-base font-semibold">{auction.name}</h2>
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
        <p className="mt-1 text-sm text-text-muted">
          {auction.lot_count} {auction.lot_count === 1 ? "lot" : "lots"}
        </p>
      </div>
    </Link>
  );
}

"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicAuction, getPublicLot } from "@/lib/api/publicEndpoints";
import { ApiError } from "@/lib/api/errors";
import { noteSeen, wasSeen } from "@/lib/public/seen";
import { formatRemaining, isLotOpen } from "@/lib/format/time";
import { lotOutcome } from "@/lib/format/lotStatus";
import { useNow } from "@/lib/hooks/useTicker";
import { LotGallery } from "@/components/lot/LotGallery";
import { Countdown } from "@/components/ui/Countdown";
import { ErrorState } from "@/components/ui/ErrorState";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { GoneState } from "@/components/public/GoneState";

/**
 * One lot, read-only — and the page a shared link opens.
 *
 * The photography is the content here, so it keeps the real image viewer
 * (`LotGallery`, scroll-snap, tap to move through the set) rather than a
 * cut-down one: that component takes images, a fallback and a title, none of
 * which are member data. What it does not have is any control that acts —
 * there is no disabled Bid button, because a disabled control is an invitation
 * to work out how to enable it.
 */
export function PublicLotScreen({ lotId }: { lotId: string }) {
  const now = useNow();
  const { data: lot, isPending, error, refetch } = useQuery({
    queryKey: ["public", "lot", lotId],
    queryFn: () => getPublicLot(lotId),
  });

  // The lot payload names its auction but not the currency, so this resolves it
  // — one cached request, shared with the auction screen's own query. The same
  // trade NOTES.md records elsewhere.
  const { data: auction } = useQuery({
    queryKey: ["public", "auction", lot?.auction_id],
    queryFn: () => getPublicAuction(lot!.auction_id),
    enabled: Boolean(lot?.auction_id),
  });
  const currency = auction?.currency_code ?? "ZAR";

  useEffect(() => {
    if (lot) noteSeen(lot.id);
  }, [lot]);

  if (error) {
    const status = error instanceof ApiError ? error.status : null;
    if (status === 404) {
      return wasSeen(lotId) ? (
        <GoneState kind="lot" />
      ) : (
        <ErrorState error={error} onRetry={() => void refetch()} title="We couldn't find that lot" />
      );
    }
    return <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load this lot" />;
  }

  if (isPending || !lot) {
    return (
      <PhoneColumn className="py-6">
        <Skeleton className="h-72 w-full rounded-card" />
        <Skeleton className="mt-4 h-8 w-2/3" />
        <Skeleton className="mt-2 h-6 w-1/3" />
      </PhoneColumn>
    );
  }

  const open = isLotOpen(lot.status, lot.effective_ends_at, now);
  const urgent = open && now !== null && formatRemaining(lot.effective_ends_at, now).urgent;
  const notYetOpen = lot.status === "scheduled";
  const hasBids = lot.current_bid_minor !== null && lot.bid_count > 0;
  const outcome = notYetOpen
    ? null
    : lotOutcome(lot.status, { clockExpired: !open, hasBids: lot.bid_count > 0 });

  return (
    <div className="flex flex-1 flex-col">
      <LotGallery images={lot.images} fallbackSrc={lot.primary_image_url} title={lot.title} />

      <PhoneColumn className="pb-8">
        <div className="flex items-center justify-between gap-2 pt-4">
          <StatusPill>Lot {lot.lot_number}</StatusPill>
          {open && urgent ? (
            <Countdown endsAt={lot.effective_ends_at} prefix="Closes in" />
          ) : open ? (
            <StatusPill tone="live" pulse>
              <Countdown endsAt={lot.effective_ends_at} prefix="Closes in" plain />
            </StatusPill>
          ) : notYetOpen ? (
            <StatusPill>Not open yet</StatusPill>
          ) : (
            <StatusPill tone={outcome?.tone ?? "muted"}>{outcome?.label ?? "Closed"}</StatusPill>
          )}
        </div>

        <h1 className="mt-3 text-2xl leading-tight font-semibold">{lot.title}</h1>

        <div className="mt-4 rounded-card border border-border bg-surface p-4">
          <p className="text-xs tracking-wide text-text-muted uppercase">
            {hasBids ? "Current bid" : "Starting at"}
          </p>
          <p className="tabular mt-1 text-3xl font-semibold text-accent-text">
            <Money
              minor={hasBids ? (lot.current_bid_minor ?? 0) : lot.starting_price_minor}
              currency={currency}
            />
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {lot.bid_count === 0
              ? "No bids yet"
              : `${lot.bid_count} bid${lot.bid_count === 1 ? "" : "s"}`}
            {/* A boolean, and all a visitor may ever see of a reserve. */}
            {hasBids && !lot.reserve_met ? " · reserve not met" : ""}
          </p>
          {open ? (
            <p className="mt-3 text-sm text-text-muted">
              Next bid from{" "}
              {/* Server-owned and price-banded. Read, never computed. */}
              <Money minor={lot.minimum_next_bid_minor} currency={currency} className="text-text" />
            </p>
          ) : null}
        </div>

        {lot.description ? (
          <section className="mt-6">
            <h2 className="text-xs tracking-wide text-text-muted uppercase">Description</h2>
            <p className="mt-2 text-sm whitespace-pre-line text-text-muted">{lot.description}</p>
          </section>
        ) : null}

        <p className="mt-8 text-center text-sm text-text-muted">
          <Link href={`/auctions/${lot.auction_id}`} className="text-accent-text underline underline-offset-4">
            See the rest of this auction
          </Link>
        </p>
      </PhoneColumn>
    </div>
  );
}

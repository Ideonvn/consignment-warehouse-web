"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelAutoBid, getAuction, getLot } from "@/lib/api/endpoints";
import { patchLot } from "@/lib/api/cache";
import { queryKeys } from "@/lib/api/queryKeys";
import { useLotSubscription } from "@/lib/hooks/useLotSubscription";
import { useNow } from "@/lib/hooks/useTicker";
import { isLotOpen } from "@/lib/format/time";
import { lotOutcome } from "@/lib/format/lotStatus";
import { BidHistory } from "@/components/lot/BidHistory";
import { LotGallery } from "@/components/lot/LotGallery";
import { BidSheet } from "@/components/bid/BidSheet";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { ErrorState } from "@/components/ui/ErrorState";
import { Money } from "@/components/ui/Money";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { useToast } from "@/components/ui/Toast";
import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { usePricePulse } from "@/lib/realtime/store";
import { cn } from "@/lib/utils/cn";

export function LotDetailScreen({ lotId }: { lotId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [bidOpen, setBidOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data: lot, isPending, error, refetch } = useQuery({
    queryKey: queryKeys.lot(lotId),
    queryFn: () => getLot(lotId),
  });

  const { data: auction } = useQuery({
    queryKey: queryKeys.auction(lot?.auction_id ?? ""),
    queryFn: () => getAuction(lot!.auction_id),
    enabled: Boolean(lot?.auction_id),
  });

  const currency = auction?.currency_code ?? "ZAR";

  useLotSubscription([{ id: lotId, sequence: lot?.bid_sequence }]);
  const pulse = usePricePulse(lotId);
  const now = useNow();

  const cancelAuto = useMutation({
    mutationFn: () => cancelAutoBid(lotId),
    onSuccess: () => {
      patchLot(queryClient, lotId, { my_auto_bid_max_minor: null });
      setCancelOpen(false);
      showToast({
        title: "Automatic bidding stopped",
        description: "Bids already placed still stand.",
        tone: "neutral",
      });
    },
    onError: (cause) =>
      showToast({
        title: "Couldn't stop automatic bidding",
        description: cause instanceof Error ? cause.message : undefined,
        tone: "danger",
      }),
  });

  if (isPending) return <LotDetailSkeleton />;
  if (error || !lot) {
    return <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load this lot" />;
  }

  const hasBids = lot.bid_count > 0 && lot.current_bid_minor !== null;
  const open = isLotOpen(lot.status, lot.effective_ends_at, now);
  // A lot that hasn't opened yet is not a closed lot, and must never read as one.
  const notYetOpen = lot.status === "scheduled";
  const outcome = notYetOpen
    ? null
    : lotOutcome(lot.status, {
        clockExpired: !open,
        amILeading: lot.am_i_leading,
        hasBids: lot.bid_count > 0,
      });

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative">
        <LotGallery images={lot.images} fallbackSrc={lot.primary_image_url} title={lot.title} />
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="absolute top-3 left-3 grid h-11 w-11 place-items-center rounded-full bg-bg/70 backdrop-blur"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <PhoneColumn className="pb-8">
        <div className="flex items-center justify-between gap-2 pt-4">
          <StatusPill>Lot {lot.lot_number}</StatusPill>
          {open ? (
            <StatusPill tone="live" pulse>
              <Countdown endsAt={lot.effective_ends_at} prefix="Closes in" />
            </StatusPill>
          ) : notYetOpen ? (
            <StatusPill>
              {auction ? (
                <Countdown endsAt={auction.starts_at} prefix="Opens in" endedLabel="Opening…" />
              ) : (
                "Opens soon"
              )}
            </StatusPill>
          ) : (
            <StatusPill tone={outcome?.tone ?? "muted"}>
              {outcome?.label ?? "Closed"}
            </StatusPill>
          )}
        </div>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{lot.title}</h1>

        <div className="mt-4 rounded-card border border-border bg-surface p-4">
          <p className="text-xs tracking-wide text-text-muted uppercase">
            {hasBids ? "Current bid" : "Starting at"}
          </p>
          <p
            key={pulse}
            className={cn(
              "mt-1 text-4xl font-semibold text-accent",
              pulse > 0 && "animate-pulse-accent",
            )}
          >
            <Money
              minor={hasBids ? (lot.current_bid_minor ?? 0) : lot.starting_price_minor}
              currency={currency}
            />
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
            <span>
              {lot.bid_count} bid{lot.bid_count === 1 ? "" : "s"}
            </span>
            {open ? (
              <span>
                Next bid from <Money minor={lot.minimum_next_bid_minor} currency={currency} />
              </span>
            ) : null}
            {hasBids && !lot.reserve_met ? <span>Reserve not met</span> : null}
            {lot.extension_count > 0 ? (
              <span>Extended {lot.extension_count}×</span>
            ) : null}
          </div>

          {notYetOpen ? (
            <p className="mt-3 rounded-xl bg-surface-raised px-3 py-2 text-sm font-medium text-text-muted">
              Bidding hasn&apos;t opened on this lot yet.
            </p>
          ) : !open && outcome ? (
            <p
              className={cn(
                "mt-3 rounded-xl px-3 py-2 text-sm font-medium",
                outcome.tone === "success" ? "bg-success/10 text-success"
                : outcome.tone === "danger" ? "bg-danger/10 text-danger"
                : "bg-surface-raised text-text-muted",
              )}
            >
              {outcome.detail}
            </p>
          ) : lot.am_i_leading ? (
            <p className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-sm font-medium text-success">
              You&apos;re winning this lot.
            </p>
          ) : lot.my_auto_bid_max_minor !== null ? (
            <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              You&apos;ve been outbid.
            </p>
          ) : null}

          {lot.my_auto_bid_max_minor !== null ? (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-sm text-text-muted">
                Your maximum:{" "}
                <Money
                  minor={lot.my_auto_bid_max_minor}
                  currency={currency}
                  className="font-semibold text-text"
                />
              </p>
              {/* Once the lot is closed neither control can do anything, and
                  offering them on a lot someone just won reads as a mistake. */}
              {open ? (
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => setBidOpen(true)} className="flex-1">
                    Raise maximum
                  </Button>
                  <Button variant="danger" onClick={() => setCancelOpen(true)} className="flex-1">
                    Stop auto-bidding
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <Button
              size="lg"
              fullWidth
              className="mt-4"
              disabled={!open}
              onClick={() => setBidOpen(true)}
            >
              {open ? "Place a bid" : notYetOpen ? "Not open yet" : "Bidding closed"}
            </Button>
          )}
        </div>

        {lot.description ? (
          <section className="mt-6">
            <h2 className="text-sm font-semibold tracking-wide text-text-muted uppercase">
              Description
            </h2>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{lot.description}</p>
          </section>
        ) : null}

        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-text-muted uppercase">
            Bid history
          </h2>
          <div className="mt-2">
            <BidHistory lotId={lotId} currency={currency} />
          </div>
        </section>
      </PhoneColumn>

      <BidSheet
        lot={lot}
        currency={currency}
        open={bidOpen}
        onClose={() => setBidOpen(false)}
      />

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Stop automatic bidding?">
        <div className="px-5 pb-6">
          <p className="text-sm text-text-muted">
            We&apos;ll stop bidding for you on this lot. <strong className="text-text">Bids you
            have already placed still stand</strong> — this does not retract them, and if nobody
            outbids you, you still win at the current price.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button
              variant="danger"
              size="lg"
              fullWidth
              loading={cancelAuto.isPending}
              onClick={() => cancelAuto.mutate()}
            >
              Stop automatic bidding
            </Button>
            <Button variant="secondary" size="lg" fullWidth onClick={() => setCancelOpen(false)}>
              Keep bidding for me
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function LotDetailSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <PhoneColumn className="pt-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-3 h-8 w-3/4" />
        <Skeleton className="mt-4 h-44 w-full rounded-card" />
        <Skeleton className="mt-6 h-24 w-full" />
      </PhoneColumn>
    </div>
  );
}

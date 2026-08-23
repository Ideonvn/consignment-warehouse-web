"use client";

import { useEffect, useRef } from "react";
import { useBrowseSession, useSessionFor } from "@/lib/browse/browseSession";
import { useLoadMoreOnScroll } from "@/lib/hooks/useLoadMoreOnScroll";
import { useNow } from "@/lib/hooks/useTicker";
import { isLotOpen } from "@/lib/format/time";
import { Countdown } from "@/components/ui/Countdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { LotImage } from "@/components/ui/LotImage";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import type { LotSummary } from "@/types/api";

export function GalleryLayout({
  auctionId,
  lots,
  currency,
  isPending,
  isFetchingMore,
  hasMore,
  loadMore,
  onOpenLot,
}: {
  auctionId: string;
  /**
   * The lots to show. A `LotSummary`, not the member type: this grid renders the
   * same way for a signed-in bidder and a stranger, because a photo and a price
   * are the same photo and price either way.
   */
  lots: LotSummary[];
  currency: string;
  isPending: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  /** Where a tile leads. The stack when signed in; the lot page when not. */
  onOpenLot: (lot: LotSummary) => void;
}) {
  const { galleryAnchor } = useSessionFor(auctionId);
  const setGalleryAnchor = useBrowseSession((state) => state.setGalleryAnchor);
  const gridRef = useRef<HTMLUListElement>(null);
  const sentinel = useLoadMoreOnScroll(hasMore, loadMore);

  // Restore on the way back. Runs on mount because the gallery unmounts while
  // the stack is showing.
  useEffect(() => {
    const saved = galleryAnchor;
    if (!saved || !gridRef.current) return;

    const present = new Set(
      Array.from(gridRef.current.querySelectorAll<HTMLElement>("[data-lot-id]")).map(
        (node) => node.dataset.lotId ?? "",
      ),
    );
    // Walk forward through the order as it was: the first lot still in the grid
    // is the closest thing to where they were standing.
    const target =
      [saved.lotId, ...saved.order.slice(saved.order.indexOf(saved.lotId) + 1)].find((id) =>
        present.has(id),
      ) ?? null;
    if (!target) return;

    const node = gridRef.current.querySelector<HTMLElement>(`[data-lot-id="${target}"]`);
    if (!node) return;
    // Put the tile back where the eye left it, not at the top of the screen.
    window.scrollTo({ top: window.scrollY + node.getBoundingClientRect().top - saved.offset });
    setGalleryAnchor(auctionId, null);
  }, [galleryAnchor, lots, auctionId, setGalleryAnchor]);

  function rememberPosition(lot: LotSummary) {
    const node = gridRef.current?.querySelector<HTMLElement>(`[data-lot-id="${lot.id}"]`);
    setGalleryAnchor(auctionId, {
      lotId: lot.id,
      offset: node ? node.getBoundingClientRect().top : 0,
      order: lots.map((row) => row.id),
    });
  }

  if (isPending) {
    return (
      <div className="mx-auto grid w-full max-w-(--app-width) grid-cols-2 gap-2 px-4">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="aspect-square w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (lots.length === 0) {
    return (
      <div className="mx-auto w-full max-w-(--app-width) px-4 pb-8">
        <EmptyState
          title="That's every lot"
          description="You've been through the whole auction."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-(--app-width) px-4 pb-8">
      <p className="mb-2 text-xs text-text-muted">
        {lots.length} {lots.length === 1 ? "lot" : "lots"} · tap a photo to
        open the cards there
      </p>

      <ul ref={gridRef} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {lots.map((lot) => (
          <li key={lot.id} data-lot-id={lot.id}>
            <GalleryTile
              lot={lot}
              currency={currency}
              onOpen={() => {
                rememberPosition(lot);
                onOpenLot(lot);
              }}
            />
          </li>
        ))}
      </ul>

      <div ref={sentinel} aria-hidden className="h-px" />
      {isFetchingMore ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <Skeleton className="aspect-square w-full rounded-2xl" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Minimal chrome: the price, and whether the clock is running. Not a card in
 * miniature — the photography is the reason this layout exists, and every badge
 * added here is a piece of the photo taken away.
 */
function GalleryTile({
  lot,
  currency,
  onOpen,
}: {
  lot: LotSummary;
  currency: string;
  onOpen: () => void;
}) {
  const now = useNow();
  const open = isLotOpen(lot.status, lot.effective_ends_at, now);
  const hasBids = lot.current_bid_minor !== null && lot.bid_count > 0;
  const price = hasBids ? (lot.current_bid_minor ?? 0) : lot.starting_price_minor;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Lot ${lot.lot_number}, ${lot.title}. Opens the cards at this lot.`}
      className="group relative block aspect-square w-full overflow-hidden rounded-2xl border border-border bg-surface text-left"
    >
      <LotImage src={lot.primary_image_url} alt={lot.title} sizes="(min-width: 640px) 33vw, 50vw" />

      {/* A scrim rather than a panel: the text has to be readable over a photo of
          unknown brightness without hiding the photo. */}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent p-2">
        <span className="tabular block text-sm font-semibold text-white">
          <Money minor={price} currency={currency} />
        </span>
        <span className="block truncate text-[11px] text-white/80">
          {open ? (
            <Countdown endsAt={lot.effective_ends_at} />
          ) : lot.status === "scheduled" ? (
            "Not open yet"
          ) : (
            "Closed"
          )}
        </span>
      </span>
    </button>
  );
}

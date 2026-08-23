"use client";

import { CANCEL_WINDOW_MS, type PendingBid } from "@/lib/bid/pendingBid";
import { useNow } from "@/lib/hooks/useTicker";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";

/**
 * The cancel window, where the three action buttons normally are.
 *
 * It replaces them rather than sitting above them so the geometry is identical —
 * the stack's height at 360×480 was measured, and Cancel lands exactly where the
 * thumb already is after a swipe. The card underneath stays swipeable, so nothing
 * is actually blocked: a swipe on the next card sends this bid, as intended.
 */
export function PendingBidStrip({
  pending,
  onCancel,
}: {
  pending: PendingBid;
  onCancel: () => void;
}) {
  const now = useNow();
  const remainingMs = now === null ? CANCEL_WINDOW_MS : Math.max(0, pending.dueAt - now);
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent-text/50 bg-surface px-3 py-1.5 shadow-lg shadow-black/40">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          Bidding <Money minor={pending.amountMinor} currency={pending.currency} /> on lot{" "}
          {pending.lot.lot_number}
        </p>
        {/* The number is the countdown, and it survives reduced motion. The bar is
            decoration on top of it — see the note on the animation below. */}
        <p aria-live="polite" className="text-xs text-text-muted">
          Sending in {seconds}s
        </p>
        <span
          aria-hidden
          className="mt-0.5 block h-1 w-full overflow-hidden rounded-full bg-border motion-reduce:hidden"
        >
          <span
            className="block h-full rounded-full bg-accent-text"
            style={{
              // Animated by the browser rather than the 1s ticker, so it drains
              // smoothly; `prefers-reduced-motion` hides the bar and leaves the
              // number, which is the part that carries the information.
              animation: `pending-bid-drain ${CANCEL_WINDOW_MS}ms linear forwards`,
            }}
          />
        </span>
      </div>

      <Button
        size="lg"
        variant="secondary"
        onClick={onCancel}
        className="shrink-0 border-danger/50 text-danger"
      >
        Cancel
      </Button>
    </div>
  );
}

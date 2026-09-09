"use client";

import { useState } from "react";
import { formatDuration, formatZonedDateTime } from "@/lib/format/time";
import { Money } from "@/components/ui/Money";
import { Sheet } from "@/components/ui/Sheet";
import { PaymentDetails } from "@/components/account/PaymentDetails";
import type { Auction } from "@/types/api";

/**
 * "What are the rules here?", answered from fields the auction already carries.
 *
 * **Three things asked for are deliberately absent rather than invented:** the
 * buyer's premium (the column exists on the auction but `AuctionOut` does not
 * expose it — noted in NOTES.md as a backend request), VAT treatment, and the
 * collection address. There is no data for any of them, and the payments config
 * already sets the precedent: an honest "contact the warehouse" beats invented
 * detail on a screen about money.
 */
export function AuctionInfoSheet({ auction }: { auction: Auction }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`About ${auction.name}: deposit, closing time and how late bids work`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-text-muted hover:text-text"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="10" cy="10" r="7.75" />
          <path d="M10 9v4.5" strokeLinecap="round" />
          <circle cx="10" cy="6.4" r="1" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={auction.name}>
        <div className="flex flex-col gap-5 px-5 pt-2 pb-6 text-sm">
          <section>
            <h3 className="text-xs font-semibold tracking-wide text-text-muted">
              BEFORE YOU CAN BID
            </h3>
            <p className="mt-1">
              {auction.deposit_amount_minor > 0 ? (
                <>
                  <Money
                    minor={auction.deposit_amount_minor}
                    currency={auction.currency_code}
                    className="font-semibold"
                  />{" "}
                  must be on your account before you can bid in this auction. Browsing needs
                  nothing.
                </>
              ) : (
                <>No deposit is needed to bid in this auction.</>
              )}
            </p>
          </section>

          <section>
            <h3 className="text-xs font-semibold tracking-wide text-text-muted">WHEN IT CLOSES</h3>
            <p className="mt-1">{formatZonedDateTime(auction.ends_at)}</p>
            <p className="mt-1 text-xs text-text-muted">
              Each lot closes on its own clock, and a late bid moves only that lot.
            </p>
          </section>

          <section>
            <h3 className="text-xs font-semibold tracking-wide text-text-muted">
              LATE BIDS EXTEND A LOT
            </h3>
            <p className="mt-1">
              A bid placed in a lot&apos;s last{" "}
              {formatDuration(auction.anti_snipe_window_seconds)} pushes that lot&apos;s closing
              time out by {formatDuration(auction.anti_snipe_extension_seconds)}, so nobody wins by
              bidding at the last second. It can happen up to {auction.max_extensions}{" "}
              {auction.max_extensions === 1 ? "time" : "times"} on one lot.
            </p>
          </section>

          <section>
            <h3 className="text-xs font-semibold tracking-wide text-text-muted">HOW TO PAY</h3>
            <PaymentDetails className="mt-1" />
          </section>
        </div>
      </Sheet>
    </>
  );
}

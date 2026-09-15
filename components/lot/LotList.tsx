"use client";

import Link from "next/link";
import type { RefCallback } from "react";
import { useNow } from "@/lib/hooks/useTicker";
import { formatDuration, isLotOpen } from "@/lib/format/time";
import { lotOutcome, type LotOutcome } from "@/lib/format/lotStatus";
import { useMyBidStatus, type MyBidStatus } from "@/lib/hooks/useMyBidStatus";
import { useLoadMoreOnScroll } from "@/lib/hooks/useLoadMoreOnScroll";
import { useSettledFigure } from "@/lib/hooks/useSettledFigure";
import type { LotActions } from "@/lib/hooks/useLotActions";
import { useLotNotice, type LotNotice } from "@/lib/realtime/store";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { LotImage } from "@/components/ui/LotImage";
import { Money } from "@/components/ui/Money";
import { formatMoney } from "@/lib/format/money";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/utils/cn";
import type { LotCard, LotSummary } from "@/types/api";

/**
 * The auction, and the whole product.
 *
 * Two buttons a row: the most you'll pay, and bid this amount now. **There is no
 * pass** — passing was half of a swipe model that no longer exists — and nothing
 * ever leaves this list because of something the user did. A lot goes when it
 * ends, and that is the only reason.
 *
 * The row is quiet by default and gets louder on its own as its clock runs down.
 * That is the whole reconciliation between "fewest buttons, cleanest screen" and
 * "much more urgency": nothing was added to the layout — the same elements
 * change state as a function of `effective_ends_at`.
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
  watchRow,
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
  /** Reports each row's visibility, so the screen can subscribe what is on screen. */
  watchRow?: RefCallback<HTMLElement>;
}) {
  const { statusFor, truncated } = useMyBidStatus(Boolean(actions));
  const sentinel = useLoadMoreOnScroll(hasMore, loadMore);
  // Needed here, not just inside the row, to decide which of the two lines a
  // row gets. Every row already re-renders on the tick from its own `useNow`,
  // so this subscribes the list to a clock it was paying for anyway.
  const now = useNow();

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
      {/* The lot count lives on the auction header's summary line, which states
          the auction's own total rather than however many pages have loaded —
          two counts that disagree while paging is worse than one. */}
      {truncated ? (
        <p className="mt-2 mb-2 rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs text-text-muted">
          You have more bids than we can list at once, so some rows can&apos;t show whether
          you&apos;re winning. Open a lot to see for certain.
        </p>
      ) : null}

      {/* Cards are separated by space and a full border rather than by a rule:
          each lot is a thing you act on, not a line in a table. */}
      <ul className="flex flex-col gap-3 pt-2">
        {lots.map((lot) => {
          const open = isLotOpen(lot.status, lot.effective_ends_at, now);
          const mine = statusFor(lot.id);
          return (
            <li key={lot.id} ref={watchRow} data-lot-id={lot.id}>
              <LotRow
                lot={lot}
                currency={currency}
                biddingOpen={biddingOpen}
                /**
                 * **On a closed lot the interesting fact is what happened to
                 * the lot, not what the caller was doing.** A closed row used
                 * to carry two lines saying nearly the same nothing —
                 * "Bidding closed" over "NOT BIDDING" — so the outcome
                 * replaces the first and the bid state stands down entirely.
                 */
                bidStatus={open ? mine : null}
                outcome={
                  open
                    ? null
                    : lotOutcome(lot.status, {
                        // Positive evidence only: "You won" when we hold the
                        // row saying so, never a claim inferred from a row we
                        // may simply not have.
                        clockExpired: true,
                        amILeading: mine === "leading",
                        hasBids: lot.bid_count > 0,
                      })
                }
                actions={actions}
              />
            </li>
          );
        })}
      </ul>

      <div ref={sentinel} aria-hidden className="h-px" />
      {isFetchingMore ? <Skeleton className="mt-3 h-24 w-full rounded-2xl" /> : null}
    </div>
  );
}

/* ------------------------------------------------------------ bid state --- */

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 8.5l3.2 3.2L13 4.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BangMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.75v4" strokeLinecap="round" />
      <circle cx="8" cy="11.15" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function NeutralMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="8" cy="8" r="6.25" strokeDasharray="2.6 2.2" />
    </svg>
  );
}

/**
 * All four states carry an icon **and** a word. Colour is never the only signal
 * — the same rule the countdown follows, for the same reason.
 *
 * `unknown` is not a tidier `none`. `/me/bids` caps at 200 with no offset, so
 * past that the app genuinely cannot tell whether someone has money on a lot,
 * and asserting "not bidding" would be a lie about their own bids.
 */
const BID_STATUS: Record<
  MyBidStatus,
  { label: string; className: string; Icon: () => React.ReactElement }
> = {
  leading: { label: "WINNING", className: "text-success", Icon: CheckMark },
  outbid: { label: "OUTBID", className: "text-danger", Icon: BangMark },
  none: { label: "NOT BIDDING", className: "text-text-muted", Icon: NeutralMark },
  unknown: { label: "BID STATUS UNKNOWN", className: "text-text-muted", Icon: NeutralMark },
};

/* --------------------------------------------------------- in-card alert --- */

/** How long a transient alert stays up. */
const NOTICE_MS = 6_000;

/**
 * The lot's latest socket event, while it is still fresh.
 *
 * No timer and no local state: the row already re-renders every second off
 * `useNow()`, so the alert simply stops being current. That also means a row
 * scrolled into view long after the event never flashes a stale alert — the
 * age is measured from the notice's own stamp, and both it and `now` are on the
 * server-anchored clock rather than the device's.
 */
function freshNotice(notice: LotNotice | undefined, now: number | null): LotNotice | null {
  if (!notice || now === null) return null;
  return now - notice.at < NOTICE_MS ? notice : null;
}

const span = (ms: number) => formatDuration(Math.abs(ms) / 1000);

/**
 * One line, inside the card's border. The stakeholder raised this specifically:
 * an alert about lot 2 floating in the gap between lot 2 and lot 3 belongs to
 * neither of them.
 *
 * It says nothing about **who** bid. The socket payload carries a handle and it
 * is deliberately not used.
 */
function LotAlert({
  notice,
  lotNumber,
  currency,
}: {
  notice: LotNotice;
  lotNumber: number;
  currency: string;
}) {
  if (notice.kind === "bid") {
    return (
      <p
        role="status"
        className="animate-notice flex items-center gap-2 border-t border-border bg-danger/10 px-3 py-2 text-xs font-medium text-danger"
      >
        <BangMark />
        <span>
          Another bidder just bid <Money minor={notice.amountMinor} currency={currency} />
        </span>
      </p>
    );
  }

  if (notice.kind === "extended") {
    return (
      <p
        role="status"
        className="animate-notice flex items-center gap-2 border-t border-border bg-accent/10 px-3 py-2 text-xs font-medium text-accent-text"
      >
        <ClockPlusMark />
        <span>
          {/* The size of the jump is only stated when we actually measured a
              forward one. A cache that was behind the server would otherwise
              produce a confident wrong figure. */}
          Bid received — lot {lotNumber} extended
          {notice.addedMs !== null && notice.addedMs > 0 ? ` by ${span(notice.addedMs)}` : ""}
        </span>
      </p>
    );
  }

  // A reschedule is an admin moving the auction's clock and can pull the close
  // time EARLIER. It never borrows the extension's wording.
  return (
    <p
      role="status"
      className="animate-notice flex items-center gap-2 border-t border-border bg-surface-raised px-3 py-2 text-xs font-medium text-text"
    >
      <CalendarMark />
      <span>
        Closing time changed — lot {lotNumber}{" "}
        {notice.deltaMs === null
          ? "has a new closing time"
          : notice.deltaMs < 0
            ? `now closes ${span(notice.deltaMs)} earlier`
            : `now closes ${span(notice.deltaMs)} later`}
      </span>
    </p>
  );
}

function ClockPlusMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M14.2 8a6.25 6.25 0 1 0-3 5.33" strokeLinecap="round" />
      <path d="M8 4.5V8l2 1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.4 11.2v3.2M10.8 12.8H14" strokeLinecap="round" />
    </svg>
  );
}

function CalendarMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="2.25" y="3.5" width="11.5" height="10.25" rx="1.75" />
      <path d="M2.25 6.75h11.5M5.5 2.25v2.5M10.5 2.25v2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ----------------------------------------------------------------- row --- */

/**
 * `my_auto_bid_max_minor` is on the *member* card shape only, so this reads it
 * structurally rather than widening `LotSummary` — which both the member and the
 * public card have to satisfy. An anonymous row has no buttons anyway.
 */
function autoBidMax(lot: LotSummary): number | null {
  return (lot as Partial<LotCard>).my_auto_bid_max_minor ?? null;
}

/**
 * One lot, wherever it is listed.
 *
 * Exported because **search reuses this row rather than forking it** — a search
 * result is a structural superset of `LotSummary`, so nothing here changes. The
 * three optional props below are the whole difference between an in-auction row
 * and a cross-auction one; see "Lot search" in CLAUDE.md.
 */
export function LotRow({
  lot,
  currency,
  biddingOpen,
  bidStatus,
  outcome,
  auctionName,
  actions,
}: {
  lot: LotSummary;
  currency: string;
  biddingOpen: boolean;
  /**
   * The bidder's own state, or **null when the app genuinely cannot say**.
   *
   * Null renders no line at all rather than falling back to "NOT BIDDING":
   * `/me/bids` is windowed by the two-week rule and search is not, so on a row
   * from an auction that aged out of that window there is no answer to give.
   */
  bidStatus: MyBidStatus | null;
  /**
   * What became of a closed lot — sold, unsold, reserve not met. Replaces the
   * bare "Bidding closed", and is what a closed search row carries instead of a
   * bid state it cannot determine.
   */
  outcome?: LotOutcome | null;
  /** Named on a cross-auction row: a lot number alone is ambiguous between sales. */
  auctionName?: string;
  /** Absent for an anonymous visitor: the row then has no buttons at all. */
  actions?: LotActions;
}) {
  const now = useNow();
  const open = isLotOpen(lot.status, lot.effective_ends_at, now);
  const hasBids = lot.current_bid_minor !== null && lot.bid_count > 0;
  const status = bidStatus === null ? null : BID_STATUS[bidStatus];
  const myMax = autoBidMax(lot);
  const canBid = Boolean(actions) && biddingOpen && open;
  const submitting = actions?.isSubmitting(lot.id) ?? false;
  // The figure follows the price live, so a press must never land on one that
  // changed under the thumb. Not held on first render: a row that has always
  // shown its figure is not a change.
  const figureSettled = useSettledFigure(lot.minimum_next_bid_minor, { holdOnMount: false });
  const notice = freshNotice(useLotNotice(lot.id), now);
  // The bid alert is only meaningful to someone with money on this lot; on a row
  // they have never bid it is noise dressed as urgency.
  const showNotice =
    notice !== null &&
    (notice.kind !== "bid" || bidStatus === "leading" || bidStatus === "outbid");

  return (
    <article className="shadow-card overflow-hidden rounded-2xl border border-border bg-surface">
      <Link href={`/lots/${lot.id}`} className="flex gap-3 p-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
          <LotImage src={lot.primary_image_url} alt={lot.title} sizes="80px" />
        </div>

        <div className="min-w-0 flex-1">
          {/*
           * The lot number, top-right, as a gold pill — **with the word on it**.
           *
           * Testers could not find it as muted text, and it is what people quote
           * out loud and in a WhatsApp message — "I'm asking about lot 1". A
           * bare `1` in a gold pill is decoration; `LOT 1` is something a person
           * reads back down a phone line, and the word is the entire point of
           * the label. It sits in the space the title already leaves, on the
           * same first line, so the row does not get taller even at `LOT 148`:
           * the title truncates instead.
           */}
          {/* Context, not the subject: the auction sits above the title in the
              quietest type on the row, and the lot stays the thing you read. */}
          {auctionName ? (
            <p className="truncate text-[0.6875rem] tracking-wide text-text-muted uppercase">
              {auctionName}
            </p>
          ) : null}

          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold">{lot.title}</p>
            <p className="tabular shrink-0 rounded-md border border-accent-edge bg-accent px-1.5 py-0.5 text-sm leading-none font-bold text-accent-ink">
              LOT {lot.lot_number}
            </p>
          </div>

          <p className="tabular mt-1 text-base font-semibold">
            <Money minor={hasBids ? (lot.current_bid_minor ?? 0) : lot.starting_price_minor} currency={currency} />
            <span className="ml-1 text-xs font-normal text-text-muted">
              {hasBids ? `· ${lot.bid_count} ${lot.bid_count === 1 ? "bid" : "bids"}` : "· no bids yet"}
            </span>
          </p>

          {/* `min-h-6` reserves the alarm pill's height up front, so a lot
              crossing any clock threshold changes no layout and cannot push the
              buttons below it off a short screen. The clock and the bid state
              each get their own line so neither can wrap the other. */}
          <div className="mt-1 flex min-h-6 items-center text-xs text-text-muted">
            {open ? (
              <Countdown endsAt={lot.effective_ends_at} />
            ) : lot.status === "scheduled" ? (
              <span>Not open yet</span>
            ) : outcome ? (
              <StatusPill tone={outcome.tone}>{outcome.label}</StatusPill>
            ) : (
              <span>Bidding closed</span>
            )}
          </div>

          {actions ? (
            <div
              className={cn(
                "mt-0.5 flex min-h-4 items-center gap-1 text-xs font-semibold tracking-wide",
                status?.className,
              )}
            >
              {status ? (
                <>
                  <status.Icon />
                  {status.label}
                </>
              ) : null}
            </div>
          ) : null}

          {/*
           * State as data, not state as a verb. The left button used to encode
           * this — "Enter Maximum" / "Raise Maximum" — which was both technical
           * and, right after a plain bid, actively confusing. Absent when there
           * is no maximum: "no auto bid set" is noise on the majority of rows.
           */}
          {myMax !== null ? (
            <p className="mt-0.5 text-xs text-text-muted">
              Your auto bid: <Money minor={myMax} currency={currency} className="text-text" />
            </p>
          ) : null}
        </div>
      </Link>

      {showNotice && notice ? (
        <LotAlert notice={notice} lotNumber={lot.lot_number} currency={currency} />
      ) : null}

      {actions ? (
        <div className="flex gap-2 border-t border-border px-3 py-2">
          {/*
           * A constant label, on every row and in every state. It says what
           * pressing it does; it does not try to describe what the server
           * already knows, which is what the data line above is for.
           */}
          <Button
            variant="secondary"
            className="flex-1 flex-col gap-0 py-1.5 leading-tight"
            disabled={!canBid}
            onClick={() => actions.openSheet(lot)}
            aria-label={`Auto bid — set your maximum on lot ${lot.lot_number}, ${lot.title}`}
          >
            <span className="text-xs font-bold tracking-wide">AUTO BID</span>
            <span className="text-[0.6875rem] font-normal text-text-muted">Set your maximum</span>
          </Button>
          {/*
           * Pressing this places the bid. No sheet, no confirmation, no delay —
           * so the amount has to be on the button itself, and it is the server's
           * own `minimum_next_bid_minor`, never a figure computed here.
           */}
          <Button
            // Held for a moment after the figure changes. Deliberately no
            // visual state: a dim flash on every rival bid across the list is
            // noise, and the in-card notice already announces the bid.
            className={cn("flex-1", canBid && !figureSettled && "disabled:opacity-100")}
            disabled={!canBid || !figureSettled}
            loading={submitting}
            onClick={() => actions.bidNow(lot, currency)}
            aria-label={`Bid ${formatMoney(lot.minimum_next_bid_minor, currency)} on lot ${lot.lot_number}, ${lot.title}`}
          >
            {/* One flex child, not two: as a bare text node beside `Money` the
                word picked up the button's own `gap-2` on top of the ordinary
                space, so the label read `BID  R 174`. The space inside `R 174`
                is Intl's en-ZA formatting and is not ours to touch. */}
            <span>
              BID <Money minor={lot.minimum_next_bid_minor} currency={currency} />
            </span>
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function ListSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-(--app-width) flex-col gap-3 px-4">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-40 w-full rounded-2xl" />
      ))}
    </div>
  );
}

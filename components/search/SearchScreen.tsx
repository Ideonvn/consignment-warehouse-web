"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/errors";
import { formatDuration, isLotOpen } from "@/lib/format/time";
import { lotOutcome } from "@/lib/format/lotStatus";
import { MIN_TERM_LENGTH, SearchCursorError, isSearchable, useLotSearch } from "@/lib/hooks/useLotSearch";
import { useLoadMoreOnScroll } from "@/lib/hooks/useLoadMoreOnScroll";
import { useLotActions } from "@/lib/hooks/useLotActions";
import { useLotSubscription } from "@/lib/hooks/useLotSubscription";
import { useOnScreenLots } from "@/lib/hooks/useOnScreenLots";
import { useMyBidStatus } from "@/lib/hooks/useMyBidStatus";
import { useNow } from "@/lib/hooks/useTicker";
import { BidSheet } from "@/components/bid/BidSheet";
import { BidOutcomeSheet } from "@/components/bid/BidOutcomeSheet";
import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { LotRow } from "@/components/lot/LotList";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";

/** Three or four requests for a ten-character term, against a 60/min ceiling. */
const DEBOUNCE_MS = 300;

/** Waits for typing to stop. The term is the query key, so React Query drops what it types past. */
function useDebounced(value: string, ms: number): string {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return settled;
}

/**
 * Lot search, across every auction.
 *
 * **Global, so it is not inside one auction's screen**, and reached from the
 * auctions header rather than from a fourth nav tab — round 1's direction was
 * fewer options, and a tab is an option on every screen forever.
 *
 * The rows are the auction list's rows, unforked: a `LotSearchResult` is a
 * structural superset of `LotSummary`. The one thing this screen does
 * differently is what it will and will not claim about the bidder's own money —
 * see "Lot search" in CLAUDE.md.
 */
export function SearchScreen() {
  const [term, setTerm] = useState("");
  const debounced = useDebounced(term, DEBOUNCE_MS);

  const search = useLotSearch(debounced);
  const actions = useLotActions(search.lots);
  const now = useNow();
  const { statusFor, truncated } = useMyBidStatus();
  const sentinel = useLoadMoreOnScroll(search.hasMore, search.loadMore);

  const trimmed = term.trim();
  // Typed past what has been asked for yet: still working, not "no matches".
  const settling = debounced.trim() !== trimmed;
  const busy = settling || search.isPending;

  /**
   * The same rule as the auction list — the rows on screen, plus a viewport
   * either side — with one difference, on purpose: only rows still taking bids.
   * A closed lot's price cannot move, and a row that cannot move does not need
   * a socket slot. A deep walk through search therefore holds a screenful of
   * lots, never the whole result set.
   */
  const { onScreen, watchRow } = useOnScreenLots();
  const live = useMemo(
    () =>
      search.lots
        .filter((lot) => onScreen.has(lot.id) && isLotOpen(lot.status, lot.effective_ends_at, now))
        .map((lot) => ({ id: lot.id, sequence: lot.bid_sequence })),
    [search.lots, onScreen, now],
  );
  useLotSubscription(live);

  const error = search.error;
  const apiError = error instanceof ApiError ? error : null;
  // A 422 without a cursor is the term itself, and belongs on the field. The
  // cursor's 422 is now an `ApiError` too — it carries the status so the
  // app-wide retry rule can read it — so "without a cursor" has to be said
  // here rather than inferred from the status alone.
  const termRefused =
    apiError?.status === 422 && !(error instanceof SearchCursorError)
      ? apiError.message
      : null;

  const sheetCurrency =
    search.lots.find((lot) => lot.id === actions.bidLot?.id)?.currency_code ?? "ZAR";

  return (
    <PhoneColumn className="pb-8">
      <ScreenHeader title="Search" backHref="/" />

      {/* No submit button: results arrive as you type. The form exists so the
          keyboard's own action key finishes the job — on a phone that saves a
          dismissal and a scroll — and it is the one thing it can usefully do. */}
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          // There is nothing to submit; closing the keyboard is the whole job.
          (document.activeElement as HTMLElement | null)?.blur();
        }}
      >
        <Input
          label="Search lots"
          hideLabel
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Title or lot number"
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          error={termRefused}
        />
      </form>

      <div className="pt-4">
        {trimmed.length === 0 ? (
          <EmptyState
            title="Find a lot"
            description="Search by what a lot is called or by its number, across every auction — including ones that have already closed."
          />
        ) : !isSearchable(trimmed) ? (
          <p className="px-1 py-6 text-sm text-text-muted">
            Keep typing — {MIN_TERM_LENGTH} letters is enough, or a lot number on its own.
          </p>
        ) : error instanceof SearchCursorError ? (
          // Our bug, not their term: reset the walk rather than blame the input.
          <div className="flex flex-col items-center gap-3 px-8 py-12 text-center" role="alert">
            <h2 className="text-base font-semibold">These results went stale</h2>
            <p className="max-w-xs text-sm text-text-muted">
              We lost our place in this search. Starting it again will show everything from the
              top.
            </p>
            <Button variant="secondary" onClick={search.restart} className="mt-1">
              Start again
            </Button>
          </div>
        ) : apiError?.status === 429 ? (
          // "3591s" is not a wait anyone can picture; the header's seconds go
          // through the same formatter every other wait in the app uses.
          <div className="flex flex-col items-center gap-3 px-8 py-12 text-center" role="alert">
            <h2 className="text-base font-semibold">Too many searches</h2>
            <p className="max-w-xs text-sm text-text-muted">
              Give it about {formatDuration(apiError.retryAfter ?? 60)} and try again.
            </p>
          </div>
        ) : termRefused ? (
          // The field already carries the server's own words. Anything here
          // would read as a second, different answer to the same refusal.
          null
        ) : error ? (
          <ErrorState error={error} title="Couldn't run that search" />
        ) : busy ? (
          <ResultsSkeleton />
        ) : search.lots.length === 0 ? (
          <EmptyState
            title="No matches"
            description={`Nothing is called “${trimmed}” and no lot has that number. Search matches a lot's title and its number — not its description, and not the auction's name.`}
          />
        ) : (
          <>
            {truncated && live.length > 0 ? (
              <p className="mb-2 rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs text-text-muted">
                You have more bids than we can list at once, so some rows can&apos;t show whether
                you&apos;re winning. Open a lot to see for certain.
              </p>
            ) : null}

            <ul className="flex flex-col gap-3">
              {search.lots.map((lot) => {
                const open = isLotOpen(lot.status, lot.effective_ends_at, now);
                // A `/me/bids` row we actually hold is positive evidence and is
                // true in both directions. Only its **absence** is ambiguous
                // outside that endpoint's window, and absence is the one thing
                // this screen refuses to read on a closed lot.
                const mine = statusFor(lot.id);
                return (
                  <li key={lot.id} ref={watchRow} data-lot-id={lot.id}>
                    <LotRow
                      lot={lot}
                      /* Every row carries its own currency. ZAR is the only one
                         in practice; passing it anyway is what stops the day it
                         isn't from being a bug hunt. */
                      currency={lot.currency_code}
                      /* Search spans auctions, so there is no single auction
                         status to gate on — and none is needed. A lot only
                         reads `live` while its auction is, and `isLotOpen`
                         inside the row settles the rest on the clock. */
                      biddingOpen
                      auctionName={lot.auction_name}
                      /**
                       * The whole point of this screen's care. A **biddable**
                       * lot's auction has not ended, so `/me/bids` reliably
                       * holds it and the join is sound. A **closed** one may
                       * sit outside that endpoint's list window, where an
                       * absent row means "filtered", not "never bid" — so this
                       * claims nothing and shows the lot's outcome instead.
                       */
                      bidStatus={open ? mine : null}
                      outcome={
                        open
                          ? null
                          : lotOutcome(lot.status, {
                              clockExpired: true,
                              // Positive evidence only: "You won" when we hold
                              // the row saying so, never "Sold to someone else"
                              // inferred from a row we may simply not have.
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
            {search.isFetchingMore ? <Skeleton className="mt-3 h-24 w-full rounded-2xl" /> : null}
          </>
        )}
      </div>

      <BidSheet
        lot={actions.bidLot}
        currency={sheetCurrency}
        open={actions.bidLot !== null}
        onClose={actions.closeBidSheet}
      />

      <BidOutcomeSheet
        state={actions.outcome}
        onClose={actions.clearOutcome}
        onRaise={actions.raiseFromOutcome}
        onBidAgain={actions.rebid}
        bidAgainOpen={actions.rebidOpen}
        bidAgainBusy={actions.rebidding}
      />
    </PhoneColumn>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-40 w-full rounded-2xl" />
      ))}
    </div>
  );
}

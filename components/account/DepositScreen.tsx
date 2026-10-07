"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Money } from "@/components/ui/Money";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PaymentDetails } from "@/components/account/PaymentDetails";
import { getMyDeposit } from "@/lib/api/endpoints";
import { depositEntryLabel } from "@/lib/format/account";
import { formatDateTime } from "@/lib/format/time";
import { cn } from "@/lib/utils/cn";
import type { DepositEntry } from "@/types/api";

const PAGE_SIZE = 25;

/**
 * The deposit in full: what we hold, what that means, how to pay more in, and
 * every movement.
 *
 * **Reached by tapping the deposit tile on the account screen**, which now
 * carries only the figure. The movements were listed inline there until
 * 2026-10-07 — a settings screen that unfolds into a statement is several
 * screens pretending to be one, and the tile had to carry explanatory copy, a
 * reference and a list before it earned its place.
 *
 * **Paying is behind a button rather than printed on the page.** Bank details
 * are five lines somebody needs exactly once, at the moment they decide to pay;
 * on the page the rest of the time they are furniture. The sheet renders the
 * same `PaymentDetails` every other surface uses, so there is one answer in the
 * app to "where do I send money".
 */
export function DepositScreen() {
  const { data, isPending, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["deposit"],
      queryFn: ({ pageParam }) => getMyDeposit({ limit: PAGE_SIZE, offset: pageParam }),
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.meta.hasMore ? allPages.length * PAGE_SIZE : undefined,
    });
  const [paying, setPaying] = useState(false);

  if (isPending) {
    return (
      <PhoneColumn className="pb-8">
        <ScreenHeader title="Deposit" backHref="/account" />
        <Skeleton className="h-36 w-full rounded-card" />
        <Skeleton className="mt-4 h-16 w-full rounded-2xl" />
      </PhoneColumn>
    );
  }

  if (error || !data) {
    return (
      <PhoneColumn className="pb-8">
        <ScreenHeader title="Deposit" backHref="/account" />
        <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load your deposit" />
      </PhoneColumn>
    );
  }

  // The held figure is the same on every page; the first is as good as any.
  const { held_minor: held, currency_code: currency } = data.pages[0].data;
  const entries = data.pages.flatMap((page) => page.data.entries);

  return (
    <PhoneColumn className="pb-8">
      <ScreenHeader title="Deposit" backHref="/account" />

      <section className="rounded-card border border-border bg-surface p-5">
        <p className="text-xs tracking-wide text-text-muted uppercase">Deposit held</p>
        <p className="mt-1 text-4xl font-semibold text-accent-text">
          <Money minor={held} currency={currency} />
        </p>
        <p className="mt-2 text-sm text-text-muted">
          {held > 0
            ? "Held as your deposit, not spent. It lets you bid in any auction asking for this much or less, and winning a lot never uses it up — it comes back when you ask for it back."
            : "You have no deposit with us, so auctions that ask for one will refuse a bid. Pay one in and you can bid straight away."}
        </p>
        <Button fullWidth className="mt-4" onClick={() => setPaying(true)}>
          {held > 0 ? "Pay more in" : "Pay your deposit"}
        </Button>
      </section>

      {entries.length > 0 ? (
        <>
          <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-text-muted uppercase">
            Movements
          </h2>
          <ul className="flex flex-col">
            {entries.map((entry) => (
              <li key={entry.id}>
                <DepositRow entry={entry} />
              </li>
            ))}
          </ul>
          {hasNextPage ? (
            <Button
              variant="ghost"
              fullWidth
              className="mt-3"
              loading={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              Show earlier deposit entries
            </Button>
          ) : null}
        </>
      ) : (
        <p className="mt-6 text-sm text-text-muted">
          Nothing has moved yet. A deposit shows up here once the warehouse has recorded it
          against your account.
        </p>
      )}

      <Sheet open={paying} onClose={() => setPaying(false)} title="Paying your deposit">
        <p className="text-sm text-text-muted">
          Transfer into the account below and quote your reference, so the warehouse can match
          the payment to you. Your deposit shows here once they have recorded it.
        </p>
        <PaymentDetails className="mt-3" />
        <Button variant="secondary" fullWidth className="mt-4" onClick={() => setPaying(false)}>
          Close
        </Button>
      </Sheet>
    </PhoneColumn>
  );
}

function DepositRow({ entry }: { entry: DepositEntry }) {
  // Signed by the server: negative is money going back out to them.
  const isOut = entry.amount_minor < 0;

  return (
    <article className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{depositEntryLabel(entry.entry_type)}</p>
        {entry.description ? (
          <p className="mt-0.5 truncate text-sm text-text-muted">{entry.description}</p>
        ) : null}
        <p className="mt-0.5 text-xs text-text-muted">
          {formatDateTime(entry.created_at)}
          {entry.reference ? ` · ${entry.reference}` : ""}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("text-sm font-semibold", isOut ? "text-danger" : "text-success")}>
          {isOut ? "−" : "+"}
          <Money minor={Math.abs(entry.amount_minor)} currency={entry.currency_code} />
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {/* Server-accumulated and continued across pages; shown as given. */}
          Held <Money minor={entry.held_after_minor} currency={entry.currency_code} />
        </p>
      </div>
    </article>
  );
}

"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getMyAccount, getMyDeposit } from "@/lib/api/endpoints";
import { describeBalance, depositEntryLabel, entryLabel } from "@/lib/format/account";
import { formatDateTime } from "@/lib/format/time";
import type { DepositEntry, LedgerEntry } from "@/types/api";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { PaymentDetails } from "@/components/account/PaymentDetails";
import { InvoicesSection } from "@/components/invoices/InvoicesSection";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { cn } from "@/lib/utils/cn";

const PAGE_SIZE = 25;

export function AccountScreen() {
  const { data, isPending, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["account"],
      queryFn: ({ pageParam }) => getMyAccount({ limit: PAGE_SIZE, offset: pageParam }),
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.meta.hasMore ? allPages.length * PAGE_SIZE : undefined,
    });

  if (isPending) {
    return (
      <PhoneColumn className="pb-8">
        <ScreenHeader title="Account" backHref="/profile" />
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="mt-4 h-16 w-full rounded-2xl" />
        <Skeleton className="mt-2 h-16 w-full rounded-2xl" />
      </PhoneColumn>
    );
  }

  if (error || !data) {
    return (
      <PhoneColumn className="pb-8">
        <ScreenHeader title="Account" backHref="/profile" />
        <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load your account" />
      </PhoneColumn>
    );
  }

  // The balance is the same on every page; the first is as good as any.
  const { balance_minor: balance, currency_code: currency } = data.pages[0].data;
  const entries = data.pages.flatMap((page) => page.data.entries);
  const standing = describeBalance(balance);

  return (
    <PhoneColumn className="pb-8">
      <ScreenHeader title="Account" backHref="/profile" />

      {/* The deposit comes first, because it is the number that answers "can I
          bid". The balance below answers "what do I owe", and the two move
          independently — winning a lot charges the balance and never touches the
          deposit. */}
      <DepositSection />

      <section
        className={cn(
          "mt-4 rounded-card border p-5",
          standing.tone === "due" ? "border-danger/40 bg-danger/5" : "border-border bg-surface",
        )}
      >
        <p className="text-xs tracking-wide text-text-muted uppercase">Your balance</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span
            className={cn(
              "text-4xl font-semibold",
              standing.tone === "due" ? "text-danger" : "text-accent-text",
            )}
          >
            <Money minor={standing.amountMinor} currency={currency} />
          </span>
          <span className="text-lg text-text-muted">{standing.headline}</span>
        </p>
        <p className="mt-2 text-sm text-text-muted">{standing.detail}</p>
      </section>

      <PaymentDetails className="mt-3" />

      <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-text-muted uppercase">
        Statement
      </h2>
      <p className="mb-2 text-xs text-text-muted">
        Lots you have won and what you have paid against them. Deposits are above.
      </p>

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing on your account yet"
          description="Lots you win, and payments against them, all show up here."
        />
      ) : (
        <ul className="flex flex-col">
          {entries.map((entry) => (
            <li key={entry.id}>
              <EntryRow entry={entry} />
            </li>
          ))}
        </ul>
      )}

      {hasNextPage ? (
        <Button
          variant="ghost"
          fullWidth
          className="mt-3"
          loading={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          Show earlier entries
        </Button>
      ) : null}

      {/* Invoices last. The BALANCE above is the authoritative answer to "what
          do I owe"; an invoice is a document covering a subset of the charges
          behind it, so an unpaid invoice alongside a settled balance just means
          a payment landed on account without being applied to that document.
          Deposit → balance → invoices is the order the questions arrive in. */}
      <InvoicesSection />
    </PhoneColumn>
  );
}

/**
 * The security deposit: what we hold, and every movement that got it there.
 *
 * A separate query and a separate list from the statement, deliberately. It is a
 * different book on the server, it answers a different question, and merging the
 * two into one history is how "you won a lot" starts reading as "your deposit was
 * spent". It was not — a deposit is held until it is returned.
 *
 * Failures here are quiet. The statement below is the screen's reason for
 * existing, and a deposit call that fails must not take it down with it.
 */
function DepositSection() {
  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["deposit"],
      queryFn: ({ pageParam }) => getMyDeposit({ limit: PAGE_SIZE, offset: pageParam }),
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.meta.hasMore ? allPages.length * PAGE_SIZE : undefined,
    });

  if (isPending) {
    return <Skeleton className="h-28 w-full rounded-card" />;
  }
  if (error || !data) return null;

  // The held figure is the same on every page; the first is as good as any.
  const { held_minor: held, currency_code: currency } = data.pages[0].data;
  const entries = data.pages.flatMap((page) => page.data.entries);

  return (
    <>
      <section className="rounded-card border border-border bg-surface p-5">
        <p className="text-xs tracking-wide text-text-muted uppercase">Deposit held</p>
        <p className="mt-1 text-4xl font-semibold text-accent-text">
          <Money minor={held} currency={currency} />
        </p>
        <p className="mt-2 text-sm text-text-muted">
          {held > 0
            ? "Held as your deposit, not spent. It lets you bid in any auction asking for this much or less, and winning a lot never uses it up."
            : "You have no deposit with us, so auctions that ask for one will refuse a bid. Pay one in and you can bid straight away."}
        </p>
      </section>

      {entries.length > 0 ? (
        <>
          <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-text-muted uppercase">
            Deposit movements
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
      ) : null}
    </>
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

function EntryRow({ entry }: { entry: LedgerEntry }) {
  // Signed by the server: negative is a charge.
  const isCharge = entry.amount_minor < 0;

  return (
    <article className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{entryLabel(entry.entry_type)}</p>
        {entry.description ? (
          <p className="mt-0.5 truncate text-sm text-text-muted">{entry.description}</p>
        ) : null}
        <p className="mt-0.5 text-xs text-text-muted">
          {formatDateTime(entry.created_at)}
          {entry.reference ? ` · ${entry.reference}` : ""}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("text-sm font-semibold", isCharge ? "text-danger" : "text-success")}>
          {isCharge ? "−" : "+"}
          <Money minor={Math.abs(entry.amount_minor)} currency={entry.currency_code} />
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {/* Server-accumulated and continued across pages; shown as given. */}
          Balance <Money minor={Math.abs(entry.balance_after_minor)} currency={entry.currency_code} />
          {entry.balance_after_minor < 0 ? " due" : ""}
        </p>
      </div>
    </article>
  );
}

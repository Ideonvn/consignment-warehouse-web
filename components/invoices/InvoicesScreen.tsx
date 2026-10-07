"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { InvoiceRow } from "@/components/invoices/InvoiceRow";
import { getMyInvoices } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils/cn";
import type { Invoice, InvoiceStatus } from "@/types/api";

const PAGE_SIZE = 25;

/**
 * **"Unpaid" means anything still owing — including overdue.** Overdue is the
 * narrower chip, a subset rather than a sibling. The other reading, where the
 * two are mutually exclusive, hides the invoices somebody most needs to see
 * from the filter they would reach for first — and hides them silently, because
 * the list still looks complete.
 */
const OWING: InvoiceStatus[] = ["unpaid", "part_paid", "overdue"];

type Filter = "all" | "unpaid" | "overdue" | "paid";

const CHIPS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
];

const EMPTY: Record<Filter, { title: string; description: string }> = {
  all: {
    title: "No invoices yet",
    description: "Win a lot and the invoice for that sale appears here.",
  },
  unpaid: {
    title: "Nothing outstanding",
    description: "Every invoice we have sent you is settled.",
  },
  overdue: {
    title: "Nothing overdue",
    description: "Nothing has passed its due date.",
  },
  paid: {
    title: "Nothing settled yet",
    description: "Invoices move here once a payment has been applied to them.",
  },
};

function matches(invoice: Invoice, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "unpaid") return OWING.includes(invoice.status);
  return invoice.status === filter;
}

/**
 * Every invoice, behind "Show all" on the account screen.
 *
 * **Filtering happens over the rows already loaded**, because `GET /me/invoices`
 * offers no status filter and `status` is derived per read rather than stored.
 * Unlike the mobile app — which asks for the endpoint's maximum in one go and
 * has a hard ceiling at it — this pages, so "Show earlier invoices" widens what
 * the filter can see. **A filtered view can therefore be empty while earlier
 * pages hold matches**, which is why the load-more button stays visible under
 * an empty state rather than being hidden with the list.
 */
export function InvoicesScreen() {
  const { data, isPending, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["invoices"],
      queryFn: ({ pageParam }) => getMyInvoices({ limit: PAGE_SIZE, offset: pageParam }),
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.meta.hasMore ? allPages.length * PAGE_SIZE : undefined,
    });
  const [filter, setFilter] = useState<Filter>("all");

  if (isPending) {
    return (
      <PhoneColumn className="pb-8">
        <ScreenHeader title="Invoices" backHref="/account" />
        <Skeleton className="h-10 w-full rounded-full" />
        <Skeleton className="mt-3 h-20 w-full rounded-2xl" />
        <Skeleton className="mt-2 h-20 w-full rounded-2xl" />
      </PhoneColumn>
    );
  }

  if (error || !data) {
    return (
      <PhoneColumn className="pb-8">
        <ScreenHeader title="Invoices" backHref="/account" />
        <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load your invoices" />
      </PhoneColumn>
    );
  }

  const invoices = data.pages.flatMap((page) => page.data);
  const shown = invoices.filter((invoice) => matches(invoice, filter));

  return (
    <PhoneColumn className="pb-8">
      <ScreenHeader title="Invoices" backHref="/account" />

      <div className="flex flex-wrap gap-2">
        {CHIPS.map(({ key, label }) => {
          const active = key === filter;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold",
                active
                  ? "border-accent-edge bg-accent text-accent-ink"
                  : "border-border bg-surface text-text",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 mb-2 text-xs text-text-muted">
        One per auction you won in. More than one for the same sale is normal — a lot settled
        after the auction closed gets its own.
      </p>

      {shown.length === 0 ? (
        <EmptyState title={EMPTY[filter].title} description={EMPTY[filter].description} />
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((invoice) => (
            <li key={invoice.id}>
              <InvoiceRow invoice={invoice} />
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
          Show earlier invoices
        </Button>
      ) : null}
    </PhoneColumn>
  );
}

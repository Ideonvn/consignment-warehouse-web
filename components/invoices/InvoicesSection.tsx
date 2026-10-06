"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { getMyInvoices } from "@/lib/api/endpoints";
import { describeInvoiceStatus, outstandingOn } from "@/lib/format/invoices";
import { formatDateTime } from "@/lib/format/time";
import type { Invoice } from "@/types/api";

const PAGE_SIZE = 25;

/**
 * The bidder's invoices, on the account screen below the statement.
 *
 * **Order matters here.** Deposit, then balance, then invoices: "can I bid",
 * "what do I owe", "what did you send me". The balance is the authoritative
 * answer to the second, and an invoice is a document covering a subset of the
 * charges behind it — so the two can legitimately disagree, and the one that
 * answers "what do I owe" comes first.
 *
 * **Failures here are quiet**, exactly like the deposit section. The statement
 * is the screen's reason for existing and an invoice call that fails must not
 * take it down.
 */
export function InvoicesSection() {
  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["invoices"],
      queryFn: ({ pageParam }) => getMyInvoices({ limit: PAGE_SIZE, offset: pageParam }),
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.meta.hasMore ? allPages.length * PAGE_SIZE : undefined,
    });

  if (isPending) return <Skeleton className="mt-6 h-20 w-full rounded-2xl" />;
  if (error || !data) return null;

  const invoices = data.pages.flatMap((page) => page.data);
  // Nothing billed yet is the ordinary state for a bidder who has not won
  // anything, so the section is absent rather than empty.
  if (invoices.length === 0) return null;

  return (
    <>
      <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-text-muted uppercase">
        Invoices
      </h2>
      <p className="mb-2 text-xs text-text-muted">
        One per auction you won in. More than one for the same sale is normal —
        a lot settled after the auction closed gets its own.
      </p>

      <ul className="flex flex-col gap-2">
        {invoices.map((invoice) => (
          <li key={invoice.id}>
            <InvoiceRow invoice={invoice} />
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
          Show earlier invoices
        </Button>
      ) : null}
    </>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const standing = describeInvoiceStatus(invoice.status);
  const owing = outstandingOn(invoice);

  return (
    <Link
      href={`/account/invoices/${invoice.id}`}
      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 hover:border-border-strong"
    >
      <div className="min-w-0">
        <p className="font-medium tabular">{invoice.number}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          Issued {formatDateTime(invoice.issued_at)}
        </p>
        <StatusPill
          className="mt-1.5"
          tone={
            standing.tone === "settled"
              ? "success"
              : standing.tone === "overdue"
                ? "danger"
                : "muted"
          }
        >
          {standing.label}
        </StatusPill>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-semibold">
          <Money minor={invoice.total_minor} currency={invoice.currency_code} />
        </p>
        {owing > 0 && owing !== invoice.total_minor ? (
          <p className="mt-0.5 text-xs text-text-muted">
            <Money minor={owing} currency={invoice.currency_code} /> still due
          </p>
        ) : null}
      </div>
    </Link>
  );
}

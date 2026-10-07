"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";
import { InvoiceRow } from "@/components/invoices/InvoiceRow";
import { getMyInvoices } from "@/lib/api/endpoints";

const PAGE_SIZE = 25;
/** Enough to show the recent ones without the account screen becoming an invoice list. */
const PREVIEW = 3;

/**
 * The bidder's invoices, third on the account screen.
 *
 * **Order matters here.** Balance, then deposit, then invoices: "what do I
 * owe", "can I bid", "what did you send me". The balance is the authoritative
 * answer to the first, and an invoice is a document covering a subset of the
 * charges behind it — so the two can legitimately disagree, and the one that
 * answers "what do I owe" leads. The deposit led until 2026-10-07; see
 * `AccountScreen` for why it no longer does.
 *
 * **Three rows and a way through, not the whole list.** This is a section on a
 * settings screen, and a bidder who has won in a dozen sales should not scroll
 * past a dozen documents to reach sign-out. The explanation of why there can be
 * several per sale moved to `/account/invoices` with the rest of them.
 *
 * It shares the `["invoices"]` infinite query with that screen, so the preview
 * costs no second request and opening the full list is instant.
 *
 * **Failures here are quiet**, exactly like the deposit section. The balance is
 * the screen's reason for existing and an invoice call that fails must not take
 * it down.
 */
export function InvoicesSection() {
  const { data, isPending, error } = useInfiniteQuery({
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

  const more = invoices.length > PREVIEW || data.pages[data.pages.length - 1].meta.hasMore;

  return (
    <>
      <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-text-muted uppercase">
        Invoices
      </h2>

      <ul className="flex flex-col gap-2">
        {invoices.slice(0, PREVIEW).map((invoice) => (
          <li key={invoice.id}>
            <InvoiceRow invoice={invoice} />
          </li>
        ))}
      </ul>

      {more ? (
        <Link
          href="/account/invoices"
          className="mt-3 block py-2 text-center text-sm font-semibold text-accent-text"
        >
          Show all invoices
        </Link>
      ) : null}
    </>
  );
}

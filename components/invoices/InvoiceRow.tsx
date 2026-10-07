"use client";

import Link from "next/link";
import { Money } from "@/components/ui/Money";
import { describeInvoiceStatus, outstandingOn } from "@/lib/format/invoices";
import { formatDateTime } from "@/lib/format/time";
import { cn } from "@/lib/utils/cn";
import type { Invoice } from "@/types/api";

/**
 * One invoice, as the account screen and the invoices screen both render it.
 *
 * **Shared on purpose.** Two renderings of the same document that drift is the
 * failure this codebase keeps writing down; a row means the same thing wherever
 * it appears, and the mobile app renders the identical shape.
 *
 * **Status is a coloured left edge, and the AMOUNT carries it in words.** It
 * used to be a `StatusPill` on its own line under the date, which spent a third
 * of the row to say one word. Colour alone is not a status — the same rule the
 * countdown and the bid states follow — so the right-hand column always says
 * what is happening in text ("Paid", "R724 due", "R300 still due", "R724
 * overdue"), and the edge only makes it faster to spot.
 *
 * **Only settled and overdue colour the edge.** Unpaid and part-paid are the
 * ordinary states of a document issued yesterday, and a row that shouts about
 * one teaches people to ignore the colour.
 */
export function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const standing = describeInvoiceStatus(invoice.status);
  const owing = outstandingOn(invoice);

  return (
    <Link
      href={`/account/invoices/${invoice.id}`}
      aria-label={`Invoice ${invoice.number}, ${standing.label}`}
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border border-l-4 border-border bg-surface px-4 py-3 hover:border-border-strong",
        standing.tone === "settled" && "border-l-success hover:border-l-success",
        standing.tone === "overdue" && "border-l-danger hover:border-l-danger",
      )}
    >
      <div className="min-w-0">
        <p className="font-medium tabular">{invoice.number}</p>
        <p className="mt-0.5 text-xs text-text-muted">Issued {formatDateTime(invoice.issued_at)}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-semibold">
          <Money minor={invoice.total_minor} currency={invoice.currency_code} />
        </p>
        {invoice.status === "paid" ? (
          <p className="mt-0.5 text-xs font-semibold text-success">Paid</p>
        ) : (
          <p
            className={cn(
              "mt-0.5 text-xs font-semibold",
              invoice.status === "overdue" ? "text-danger" : "text-text-muted",
            )}
          >
            <Money minor={owing} currency={invoice.currency_code} />{" "}
            {invoice.status === "overdue"
              ? "overdue"
              : invoice.status === "part_paid"
                ? "still due"
                : "due"}
          </p>
        )}
      </div>
    </Link>
  );
}

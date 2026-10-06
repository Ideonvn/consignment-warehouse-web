"use client";

import { useQuery } from "@tanstack/react-query";
import { ErrorState } from "@/components/ui/ErrorState";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { getMyInvoice } from "@/lib/api/endpoints";
import {
  describeInvoiceStatus,
  invoiceTitle,
  outstandingOn,
} from "@/lib/format/invoices";
import { formatDateTime } from "@/lib/format/time";
import type { InvoiceLine } from "@/types/api";
import { InvoiceDownloadButton } from "./InvoiceDownloadButton";

/**
 * One invoice, exactly as it was issued.
 *
 * **Nothing here is recalculated.** An invoice bills charges that already
 * exist on the statement and freezes them; a screen that worked the total out
 * from a rate would disagree with the document the moment the business changed
 * that rate. Every figure below is rendered as the server sent it, including
 * the status — which the server derives from what has been allocated and the
 * clock, in one place, so this screen and the PDF can never say different
 * things.
 *
 * Amounts are positive here and negative on the statement, and both are right:
 * there they reduce a balance, here they are amounts owed. A minus sign on an
 * invoice reads as a credit.
 */
export function InvoiceScreen({ invoiceId }: { invoiceId: string }) {
  const { data: invoice, isPending, error, refetch } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => getMyInvoice(invoiceId),
  });

  if (isPending) {
    return (
      <PhoneColumn className="pb-8">
        <ScreenHeader title="Invoice" backHref="/account" />
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="mt-4 h-40 w-full rounded-2xl" />
      </PhoneColumn>
    );
  }

  if (error || !invoice) {
    return (
      <PhoneColumn className="pb-8">
        <ScreenHeader title="Invoice" backHref="/account" />
        <ErrorState
          error={error}
          onRetry={() => void refetch()}
          title="Couldn't load this invoice"
        />
      </PhoneColumn>
    );
  }

  const currency = invoice.currency_code;
  const standing = describeInvoiceStatus(invoice.status);
  const owing = outstandingOn(invoice);
  const hasTax = invoice.tax_minor !== 0 || invoice.tax_rate_bps !== 0;

  return (
    <PhoneColumn className="pb-8">
      <ScreenHeader
        title={invoice.number}
        backHref="/account"
        subtitle={invoiceTitle(invoice)}
      />

      <section className="rounded-card border border-border bg-surface p-5">
        <StatusPill
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

        <p className="mt-3 text-4xl font-semibold text-accent-text">
          <Money minor={invoice.total_minor} currency={currency} />
        </p>
        <p className="mt-2 text-sm text-text-muted">{standing.detail}</p>

        {owing > 0 && invoice.paid_minor > 0 ? (
          <p className="mt-1 text-sm text-text-muted">
            <Money minor={invoice.paid_minor} currency={currency} /> received,{" "}
            <Money minor={owing} currency={currency} /> still due.
          </p>
        ) : null}

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-text-muted">Issued</dt>
            <dd className="tabular">{formatDateTime(invoice.issued_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Due</dt>
            <dd className="tabular">{formatDateTime(invoice.due_at)}</dd>
          </div>
          {invoice.vat_number.trim() ? (
            <div className="col-span-2">
              <dt className="text-xs text-text-muted">VAT number</dt>
              <dd className="tabular">{invoice.vat_number}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <div className="mt-3">
        <InvoiceDownloadButton
          invoiceId={invoice.id}
          number={invoice.number}
          variant="primary"
          fullWidth
        />
      </div>

      <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-text-muted uppercase">
        What this covers
      </h2>

      <ul className="flex flex-col">
        {invoice.lines.map((line) => (
          <li key={`${line.position}-${line.description}`}>
            <LineRow line={line} currency={currency} showTax={hasTax} />
          </li>
        ))}
      </ul>

      <dl className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
        {hasTax ? (
          <>
            <Row label="Subtotal">
              <Money minor={invoice.subtotal_minor} currency={currency} />
            </Row>
            <Row label="VAT">
              <Money minor={invoice.tax_minor} currency={currency} />
            </Row>
          </>
        ) : null}
        <Row label="Total" strong>
          <Money minor={invoice.total_minor} currency={currency} />
        </Row>
      </dl>

      {/* The reference for an INVOICE is its own number, not the per-person
          `payment_reference` the deposit and top-up screens quote. One bank
          line against one document is what makes the allocation unambiguous,
          and the PDF says the same words. */}
      <p className="mt-4 text-xs text-text-muted">
        Use{" "}
        <span className="tabular font-semibold text-text select-all">
          {invoice.number}
        </span>{" "}
        as your payment reference. An invoice never changes once it has been
        issued — if something here looks wrong, get in touch and a correction is
        made on your statement rather than on this document.
      </p>
    </PhoneColumn>
  );
}

function LineRow({
  line,
  currency,
  showTax,
}: {
  line: InvoiceLine;
  currency: string;
  showTax: boolean;
}) {
  return (
    <article className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <p className="min-w-0 text-sm">{line.description}</p>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold">
          <Money minor={line.gross_minor} currency={currency} />
        </p>
        {showTax ? (
          <p className="mt-0.5 text-xs text-text-muted">
            <Money minor={line.net_minor} currency={currency} /> + VAT
          </p>
        ) : null}
      </div>
    </article>
  );
}

function Row({
  label,
  children,
  strong = false,
}: {
  label: string;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? "text-sm font-semibold" : "text-sm text-text-muted"}>
        {label}
      </dt>
      <dd className={strong ? "text-base font-semibold" : "text-sm"}>{children}</dd>
    </div>
  );
}

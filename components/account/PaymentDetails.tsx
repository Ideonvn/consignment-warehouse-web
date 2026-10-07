"use client";

import { useQuery } from "@tanstack/react-query";
import { getPaymentDetails } from "@/lib/api/endpoints";
import { PAYMENT_INSTRUCTIONS } from "@/lib/config/payments";
import { cn } from "@/lib/utils/cn";

/**
 * How to pay, in one place. Anywhere the app asks someone for money it also
 * shows where to send it and the reference they must quote — a payment without
 * one is a payment the operator has to chase.
 *
 * **There are two references and they are not interchangeable.** Paying money
 * ONTO an account — a deposit, a top-up — quotes the bidder's own standing
 * `payment_reference`, because there is no document to name. Paying an INVOICE
 * quotes that invoice's number, so one bank line maps to one document and the
 * allocation is unambiguous; the PDF says the same words. Callers on an invoice
 * pass `invoiceNumber`, and nothing else should.
 *
 * **The bank block is fetched, never carried.** This used to say only that
 * payment was "arranged directly with the warehouse", because inventing bank
 * details in a client was rightly refused and nothing served them.
 * `GET /me/payment-details` serves them now, from the same settings the invoice
 * PDF prints — so one account number exists in the system. A copy in
 * `NEXT_PUBLIC_*` would be the one that goes stale, and the stale copy here is
 * what somebody transfers money INTO rather than one printed on a document.
 *
 * **A missing row is omitted, never labelled blank.** The five settings have no
 * defaults and the server sends `null` rather than `""`, so an operator who has
 * filled in three of five gets three rows — the same rule the renderer follows
 * on the PDF.
 *
 * **Failure is quiet and the instructions still render.** This sits inside
 * sheets someone opened for another reason — a bid refusal, a sale's terms, a
 * win — and an error about a banking lookup on top of "you can't bid yet" helps
 * nobody. Without the block they get the standing instruction to contact the
 * warehouse, which is where this started.
 */
export function PaymentDetails({
  className,
  invoiceNumber,
}: {
  className?: string;
  invoiceNumber?: string;
}) {
  const { data } = useQuery({
    queryKey: ["payment-details"],
    queryFn: getPaymentDetails,
  });

  const reference = invoiceNumber ?? data?.reference ?? null;
  const rows: [string, string | null][] = [
    ["Account name", data?.account_name ?? null],
    ["Bank", data?.bank_name ?? null],
    ["Account number", data?.account_number ?? null],
    ["Branch code", data?.branch_code ?? null],
    ["Account type", data?.account_type ?? null],
  ];
  const given = rows.filter((row): row is [string, string] => row[1] !== null);

  return (
    <div className={cn("rounded-2xl border border-border bg-surface-raised p-3", className)}>
      {given.length > 0 ? (
        <dl className="flex flex-col gap-1.5">
          {given.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 text-xs">
              <dt className="shrink-0 text-text-muted">{label}</dt>
              {/* select-all so a number is copied rather than retyped into a
                  banking app, which is where a transposed digit becomes
                  somebody else's money. */}
              <dd className="tabular text-right font-semibold break-all text-text select-all">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {reference ? (
        <p
          className={cn(
            "flex items-baseline justify-between gap-3 text-xs",
            given.length > 0 && "mt-2 border-t border-border pt-2",
          )}
        >
          <span className="shrink-0 text-text-muted">
            {invoiceNumber ? "Use this as your reference" : "Your reference"}
          </span>
          <span className="tabular font-semibold text-text select-all">{reference}</span>
        </p>
      ) : null}

      <p className={cn("text-xs text-text-muted", (given.length > 0 || reference) && "mt-3")}>
        {PAYMENT_INSTRUCTIONS}
      </p>
    </div>
  );
}

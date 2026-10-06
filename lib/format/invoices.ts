import type { InvoiceStatus } from "@/types/api";

/**
 * Wording for invoices, kept apart from `./account.ts` on purpose.
 *
 * The statement answers "what do I owe"; an invoice is a *document* covering a
 * subset of those charges. The two legitimately disagree — an unpaid invoice
 * alongside a settled account just means a payment landed on account and was
 * not applied to that document — so one shared vocabulary would make "paid"
 * mean two things on one screen.
 */

export type InvoiceStanding = {
  label: string;
  tone: "due" | "overdue" | "part" | "settled";
  /** One sentence the bidder can act on, or be reassured by. */
  detail: string;
};

/**
 * ⚠️ **Derived on the server; this only puts words to it.** The status is
 * computed from the allocations and the clock on every read, in one precedence
 * order — paid beats overdue, overdue beats part-paid — so nothing here looks
 * at `paid_minor` or `due_at` to decide. A screen that worked it out itself
 * would eventually tell someone they are overdue on an invoice the business
 * considers settled.
 */
export function describeInvoiceStatus(status: InvoiceStatus): InvoiceStanding {
  switch (status) {
    case "paid":
      return {
        label: "Paid",
        tone: "settled",
        detail: "Settled in full. Nothing further to do.",
      };
    case "part_paid":
      return {
        label: "Part paid",
        tone: "part",
        detail: "Some of this has been received. The rest is still due.",
      };
    case "overdue":
      return {
        label: "Overdue",
        tone: "overdue",
        detail: "Past its due date. Please settle it when you can.",
      };
    default:
      return {
        label: "Unpaid",
        tone: "due",
        detail: "Not yet paid.",
      };
  }
}

/** What is still owed on this document. Never negative. */
export function outstandingOn(invoice: {
  total_minor: number;
  paid_minor: number;
}): number {
  return Math.max(invoice.total_minor - invoice.paid_minor, 0);
}

/**
 * **Registration decides the title, the rate does not.** A registered vendor
 * selling at a zero rate still issues a tax invoice, and the PDF is headed
 * exactly this way. Reads the snapshot on the document, never a live setting:
 * an invoice someone already holds cannot change its own heading.
 */
export function invoiceTitle(invoice: { vat_number: string }): string {
  return invoice.vat_number.trim() ? "Tax invoice" : "Invoice";
}

/**
 * Hands the browser a downloaded PDF.
 *
 * The bytes arrive through the authenticated API rather than a presigned URL,
 * so there is nothing to put in an `href` and this has to go through an object
 * URL.
 */
export function saveBlobAs(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // On a timer, not synchronously: Safari — which is most of this app's
  // traffic — has not finished reading the URL when click() returns, and
  // revoking straight away saves an empty file.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

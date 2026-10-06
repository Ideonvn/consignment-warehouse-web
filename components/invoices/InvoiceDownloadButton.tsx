"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { getMyInvoicePdf } from "@/lib/api/endpoints";
import { NetworkError } from "@/lib/api/errors";
import { saveBlobAs } from "@/lib/format/invoices";

/**
 * Downloads the invoice.
 *
 * **Not a link**, because the document is streamed through the API rather than
 * served from a presigned URL: the request has to carry the bearer token. That
 * is the deliberate design — a presigned link is a bearer capability that
 * survives being forwarded, and an invoice names a person and what they owe.
 *
 * The failure is shown inline rather than as a toast. The button is often the
 * only thing on the row the person is looking at, and a toast at the other end
 * of a phone screen is easy to miss.
 */
export function InvoiceDownloadButton({
  invoiceId,
  number,
  variant = "secondary",
  fullWidth = false,
}: {
  invoiceId: string;
  /** The filename, so the file on disk matches the document. */
  number: string;
  variant?: "primary" | "secondary" | "ghost";
  fullWidth?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      saveBlobAs(await getMyInvoicePdf(invoiceId), `${number}.pdf`);
    } catch (cause) {
      // Same reading as ErrorState: the error classes already carry a
      // human message, so there is nothing to translate here.
      setError(
        cause instanceof NetworkError || cause instanceof Error
          ? cause.message
          : "Couldn't download that. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={fullWidth ? "w-full" : undefined}>
      <Button
        variant={variant}
        fullWidth={fullWidth}
        loading={busy}
        onClick={() => void download()}
      >
        Download PDF
      </Button>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

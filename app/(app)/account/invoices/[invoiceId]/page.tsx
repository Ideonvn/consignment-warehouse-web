import type { Metadata } from "next";
import { InvoiceScreen } from "@/components/invoices/InvoiceScreen";

export const metadata: Metadata = {
  title: "Invoice",
  description: "An invoice for lots you won.",
};

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  return <InvoiceScreen invoiceId={invoiceId} />;
}

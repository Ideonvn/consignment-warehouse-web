import type { Metadata } from "next";
import { InvoicesScreen } from "@/components/invoices/InvoicesScreen";

export const metadata: Metadata = { title: "Invoices" };

export default function InvoicesPage() {
  return <InvoicesScreen />;
}

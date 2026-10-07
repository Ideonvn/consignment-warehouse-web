import type { Metadata } from "next";
import { AccountScreen } from "@/components/account/AccountScreen";

export const metadata: Metadata = {
  title: "Account",
  description: "Your balance, your deposit, your invoices and your details.",
};

export default function AccountPage() {
  return <AccountScreen />;
}

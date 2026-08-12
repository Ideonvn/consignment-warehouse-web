import type { Metadata } from "next";
import { AccountScreen } from "@/components/account/AccountScreen";

export const metadata: Metadata = {
  title: "Account",
  description: "Your balance, deposits, payments and lots won.",
};

export default function AccountPage() {
  return <AccountScreen />;
}

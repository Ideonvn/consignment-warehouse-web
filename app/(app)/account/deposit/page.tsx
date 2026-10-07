import type { Metadata } from "next";
import { DepositScreen } from "@/components/account/DepositScreen";

export const metadata: Metadata = {
  title: "Deposit",
  description: "What the warehouse holds as your deposit, and how to pay one in.",
};

export default function DepositPage() {
  return <DepositScreen />;
}

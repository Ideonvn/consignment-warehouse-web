import type { DepositEntryType } from "@/types/api";

// `ENTRY_LABELS` / `entryLabel` lived here and went with the statement on
// 2026-10-07 — their one caller was the statement rows on the account screen,
// and nothing names a `LedgerEntryType` to a bidder any more. The ledger itself
// is untouched and `GET /me/account` still returns entries; bring the map back
// from git if a surface ever needs to print one again.

/**
 * The deposit book's own labels. Separate from the ledger's on purpose: the two
 * books answer different questions, and one shared map is how "Deposit" and
 * "Payment" end up reading as the same event.
 */
const DEPOSIT_LABELS: Record<DepositEntryType, string> = {
  paid: "Deposit received",
  refunded: "Deposit returned",
  reversal: "Correction",
};

export function depositEntryLabel(type: DepositEntryType): string {
  return DEPOSIT_LABELS[type] ?? "Correction";
}

export type BalanceStanding = {
  /** Positive magnitude to render through `Money`. */
  amountMinor: number;
  /** Plain language: "R2 000 due" reads very differently from "-200000". */
  headline: string;
  detail: string;
  tone: "due" | "credit" | "settled";
};

/**
 * A negative balance is an invoice, not an error. These are customers who have
 * just won something, so the wording stays matter-of-fact.
 */
export function describeBalance(balanceMinor: number): BalanceStanding {
  if (balanceMinor < 0) {
    return {
      amountMinor: Math.abs(balanceMinor),
      headline: "due",
      detail: "This is what you owe on your account.",
      tone: "due",
    };
  }
  if (balanceMinor > 0) {
    return {
      amountMinor: balanceMinor,
      headline: "on account",
      detail: "Credit on your account, ready for the next auction.",
      tone: "credit",
    };
  }
  return {
    amountMinor: 0,
    headline: "on account",
    detail: "Nothing owing, nothing on account.",
    tone: "settled",
  };
}

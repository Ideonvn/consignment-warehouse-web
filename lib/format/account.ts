import type { LedgerEntryType } from "@/types/api";

/**
 * `entry_type` values are internal names. A statement is something a customer
 * reads, so every one of them gets a human label.
 */
const ENTRY_LABELS: Record<LedgerEntryType, string> = {
  deposit: "Deposit",
  payment: "Payment",
  lot_won: "Lot won",
  buyers_premium: "Buyer's premium",
  refund: "Refund",
  adjustment: "Adjustment",
  // A reversal corrects an earlier entry. It is shown as its own line, never
  // netted against the original — a statement is a history, and an entry that
  // silently vanishes is worse than one that is explained.
  reversal: "Correction",
};

export function entryLabel(type: LedgerEntryType): string {
  return ENTRY_LABELS[type] ?? "Adjustment";
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

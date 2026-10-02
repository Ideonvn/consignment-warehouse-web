import type { DepositEntryType, LedgerEntryType } from "@/types/api";

/**
 * `entry_type` values are internal names. A statement is something a customer
 * reads, so every one of them gets a human label.
 */
const ENTRY_LABELS: Record<LedgerEntryType, string> = {
  // Retired in October 2026, when the deposit became its own book. Entries from
  // before then are still on statements and still need a name.
  deposit: "Deposit",
  payment: "Payment",
  lot_won: "Lot won",
  commission: "Commission",
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

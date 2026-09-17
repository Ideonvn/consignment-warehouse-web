import type { Account, LedgerEntry, LedgerEntryType } from "@/types/api";

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

export type WonLotCharges = {
  lotId: string;
  /** Positive magnitude of the stored `lot_won` entry. */
  hammerMinor: number;
  /** Positive magnitude of the stored `buyers_premium` entry; null when none was raised. */
  premiumMinor: number | null;
};

export type WinBreakdown = {
  /** One per won lot, in the order the ids were given. */
  lots: WonLotCharges[];
  /** Signed balance immediately before the charges: positive is credit, negative is owing. */
  beforeMinor: number;
};

/**
 * How a balance is made up of the charges for newly won lots, read from stored
 * ledger entries only — nothing is computed that the ledger does not already
 * hold. Returns null unless it reconciles exactly, because a "to pay" figure
 * explained by lines that do not add up is a real-money mistake.
 *
 * Entries are newest-first. The newest must be exactly the won lots' charges and
 * nothing else; the entry after them supplies "before". With no entry after them,
 * "before" is zero — and if the page simply ended early, the sum check fails.
 */
export function winBreakdown(account: Account, wonLotIds: readonly string[]): WinBreakdown | null {
  const ids = new Set(wonLotIds);
  if (ids.size === 0) return null;

  const { entries } = account;
  const isWonCharge = (entry: LedgerEntry) =>
    (entry.entry_type === "lot_won" || entry.entry_type === "buyers_premium") &&
    entry.lot_id !== null &&
    ids.has(entry.lot_id);
  let count = 0;
  while (count < entries.length && isWonCharge(entries[count])) count += 1;
  const charges = entries.slice(0, count);
  // Charges are debits; anything else is not a shape this can explain.
  if (charges.some((entry) => entry.amount_minor >= 0)) return null;

  const lots: WonLotCharges[] = [];
  for (const lotId of ids) {
    const hammer = charges.filter((e) => e.lot_id === lotId && e.entry_type === "lot_won");
    const premium = charges.filter((e) => e.lot_id === lotId && e.entry_type === "buyers_premium");
    if (hammer.length !== 1 || premium.length > 1) return null;
    lots.push({
      lotId,
      hammerMinor: -hammer[0].amount_minor,
      premiumMinor: premium.length === 1 ? -premium[0].amount_minor : null,
    });
  }

  const beforeMinor = count < entries.length ? entries[count].balance_after_minor : 0;
  const charged = charges.reduce((sum, entry) => sum + entry.amount_minor, 0);
  if (beforeMinor + charged !== account.balance_minor) return null;

  return { lots, beforeMinor };
}

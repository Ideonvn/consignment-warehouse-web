/**
 * All money is an integer number of minor units (cents). It stays an integer
 * everywhere; the divide by 100 happens once, here, at the render step.
 */

const LOCALE = "en-ZA";
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, fractionDigits: number): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(key, cached);
  }
  return cached;
}

/**
 * Whole amounts drop the cents — auction prices are almost always round and
 * "R3 050" reads faster than "R3 050,00". Anything with cents keeps them.
 */
export function formatMoney(amountMinor: number, currencyCode = "ZAR"): string {
  const digits = amountMinor % 100 === 0 ? 0 : 2;
  return formatter(currencyCode, digits).format(amountMinor / 100);
}

/** Compact form for chips and dense rows, e.g. "+R50". */
export function formatMoneyDelta(deltaMinor: number, currencyCode = "ZAR"): string {
  const sign = deltaMinor >= 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(deltaMinor), currencyCode)}`;
}

/** Parses a user-typed major-unit amount ("2 500,50", "2500.5") into cents. */
export function parseMoneyInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/\s/g, "");
  if (cleaned.length === 0) return null;

  // Treat the last separator as the decimal point, the rest as grouping.
  const lastSeparator = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  const hasDecimals = lastSeparator !== -1 && cleaned.length - lastSeparator - 1 <= 2;

  const whole = (hasDecimals ? cleaned.slice(0, lastSeparator) : cleaned).replace(/[.,]/g, "");
  const fraction = hasDecimals ? cleaned.slice(lastSeparator + 1).padEnd(2, "0") : "00";

  if (whole.length === 0 && fraction === "00") return null;

  const minor = Number(whole || "0") * 100 + Number(fraction);
  return Number.isFinite(minor) ? Math.round(minor) : null;
}

/** Major-unit string for prefilling an input, without a currency symbol. */
export function toMajorInputValue(amountMinor: number): string {
  return amountMinor % 100 === 0
    ? String(amountMinor / 100)
    : (amountMinor / 100).toFixed(2);
}

/** The currency's symbol alone, for input prefixes ("R", "$"). */
export function currencySymbol(currencyCode = "ZAR"): string {
  const parts = formatter(currencyCode, 0).formatToParts(0);
  return parts.find((part) => part.type === "currency")?.value ?? currencyCode;
}

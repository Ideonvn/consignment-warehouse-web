import { COUNTRIES, UNLISTED_COUNTRY, type Country } from "@/lib/auth/countries";

/**
 * Phone entry helpers: grouping for the eye, E.164 for the wire.
 *
 * **Hand-rolled rather than `libphonenumber-js`.** The library formats and
 * validates every country correctly and has an `AsYouType` formatter, and it
 * costs 35.7 KB gzipped in its `min` metadata build — about a tenth of this
 * app's entire client JS, on a mobile-first product whose bidders are almost
 * entirely on one dial code. What it buys is per-country *validity*, and the
 * server already decides that: a bad number comes back as a 422 either way.
 *
 * The cost of hand-rolling is stated plainly: **grouping is approximate outside
 * the countries that carry an explicit `groups` pattern.** ZA, GB and the NANP
 * are grouped the way a local writes them; everywhere else falls back to threes,
 * which is readable and countable but not necessarily conventional. If the
 * warehouse ever sells into a second country seriously, that is the moment to
 * reach for the library — the seam is `formatNational` and nothing else.
 */

/** Longest dial code first, so +27 never shadows +274 and +1 never eats +1876. */
const BY_LENGTH = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

/** The country whose dial code this international number starts with. */
function countryForE164(digits: string): Country | undefined {
  return BY_LENGTH.find((country) => digits.startsWith(country.dial));
}

export type ParsedEntry = {
  country: Country;
  /** National digits: trunk prefix and dial code already removed. */
  national: string;
};

/**
 * Make sense of whatever landed in the field — typed, autofilled or pasted.
 *
 * The three shapes people actually produce: `+27 82 000 0002` (international,
 * spaced), `0820000002` (local with a trunk zero) and `820000002` (bare
 * national). All three have to end up at the same number rather than at a
 * validation error.
 */
export function parseEntry(raw: string, current: Country): ParsedEntry {
  const hasPlus = raw.trimStart().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return { country: current, national: "" };

  if (hasPlus) {
    const match = countryForE164(digits);
    // An unlisted dial code still has to work. Handing it back under the *current*
    // country would compose that country's code onto a number that already has
    // its own — "+678 555 1234" became "+276785551234" until this was a case of
    // its own. `UNLISTED_COUNTRY` prepends nothing.
    if (!match) return { country: UNLISTED_COUNTRY, national: digits };
    return { country: match, national: stripTrunk(digits.slice(match.dial.length)) };
  }

  // A leading zero is a trunk prefix, never part of the number on the wire.
  if (digits.startsWith("0")) return { country: current, national: stripTrunk(digits) };

  // Pasted without its plus: "27820000002" is only the dial code if what remains
  // is still long enough to be a phone number.
  if (digits.startsWith(current.dial) && digits.length - current.dial.length >= 7) {
    return { country: current, national: stripTrunk(digits.slice(current.dial.length)) };
  }

  return { country: current, national: digits };
}

function stripTrunk(national: string): string {
  return national.replace(/^0+/, "");
}

/**
 * Group the national part so its length can be counted at a glance. Countries
 * carrying a `groups` pattern are exact; the rest fall back to threes, which is
 * countable but not necessarily how a local writes it.
 */
export function formatNational(national: string, country: Country): string {
  if (national.length === 0) return "";

  return group(national, country.groups ?? []);
}

function group(digits: string, sizes: number[]): string {
  const parts: string[] = [];
  let rest = digits;
  for (const size of sizes) {
    if (rest.length === 0) break;
    parts.push(rest.slice(0, size));
    rest = rest.slice(size);
  }
  while (rest.length > 0) {
    parts.push(rest.slice(0, 3));
    rest = rest.slice(3);
  }
  return parts.join(" ");
}

/** What actually goes to the backend. Never the spaces. */
export function toE164(country: Country, national: string): string {
  const digits = stripTrunk(national.replace(/\D/g, ""));
  if (digits.length === 0) return "";
  // `UNLISTED_COUNTRY` has an empty dial, so this is also the whole-number case.
  return `+${country.dial}${digits}`;
}

/**
 * The routes an anonymous visitor may see.
 *
 * **An allowlist, deliberately, and the guard stays in the layout.** The
 * alternative — no guard in the layout, `<AuthGuard>` added per private page —
 * inverts the failure direction: a new page would ship *public* unless someone
 * remembered, and the pages behind this guard show a ledger and a phone number.
 * Here a mistake leaves a public page guarded, which is loud, immediate and
 * harmless.
 *
 * These three are the canonical shareable surfaces: the catalogue, an auction,
 * and a lot. Everything else needs an account.
 */
const PUBLIC_PATHS: { exact?: string; prefix?: string }[] = [
  { exact: "/" },
  { prefix: "/auctions/" },
  { prefix: "/lots/" },
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (rule) =>
      (rule.exact !== undefined && pathname === rule.exact) ||
      (rule.prefix !== undefined && pathname.startsWith(rule.prefix)),
  );
}

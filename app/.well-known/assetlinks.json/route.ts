/**
 * App Links: what Android fetches from `https://consignment-warehouse.com`
 * before it will open an https link in the app without asking.
 *
 * A route handler for the same reason as its Apple counterpart — one place that
 * states `application/json` — and because the pair is easier to keep in step
 * when both are written the same way. Like that file it lives outside
 * `app/(app)/`, so `AuthGuard` never sees it and `lib/auth/publicPaths.ts` has
 * nothing to say about it.
 *
 * **`ANDROID_SHA256_CERT_FINGERPRINT` is a placeholder** — see NOTES.md,
 * "App-link association files". It must be the fingerprint of the certificate
 * that signs the build being shipped, which is not the same for a local build
 * and an EAS-managed one; a wrong one fails silently, so it is not guessed here.
 */
const STATEMENTS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.irithmetic.consignmentwarehouse",
      sha256_cert_fingerprints: ["ANDROID_SHA256_CERT_FINGERPRINT"],
    },
  },
];

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(JSON.stringify(STATEMENTS, null, 2), {
    headers: { "content-type": "application/json" },
  });
}

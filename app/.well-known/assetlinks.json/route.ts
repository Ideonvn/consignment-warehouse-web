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
 * **Two fingerprints, and WHICH IS WHICH IS NOT GUESSABLE FROM THE VALUES.**
 * Both were read on 2026-10-06 off Play Console -> Protected with Play -> Play
 * Store distribution -> Play app signing, and each is labelled at its own entry
 * below. Do not reorder them without moving the labels.
 *
 * The **APP SIGNING key** is Google's, not ours, and signs the APK a user
 * installs from the store. It is the fingerprint Google puts in the ready-made
 * "Digital Asset Links JSON" snippet on that same page, which is how it was
 * identified. **Without it nothing installed from the store verifies** — which
 * was the state of this file until the second entry was added.
 *
 * The **UPLOAD key** is ours, under the heading "Upload key certificate", the one
 * EAS signs with so Google knows a release is from us. It earns its place only so
 * a build installed straight from EAS verifies too; alone it does nothing for a
 * store install. It was briefly here BY ITSELF, labelled as the app signing key,
 * because the two sections sit on one screen and the headings read alike.
 *
 * Several fingerprints is the normal shape of this file, not a workaround. For a
 * build signed by anything else, read the value off the artefact rather than off
 * a screen — `apksigner verify --print-certs` on the .apk — because the
 * certificate that signed the file is the only thing Android compares against.
 *
 * ⚠️ A wrong or missing fingerprint fails **silently**: the link just opens the
 * browser, with nothing logged on the device or here. That is exactly why the
 * upload-key-only state above went unnoticed. See NOTES.md, "App-link
 * association files", for how to verify after a deploy.
 */
const STATEMENTS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.irithmetic.consignmentwarehouse",
      sha256_cert_fingerprints: [
        // Play app signing key — signs what users install from the store.
        "F2:3F:2C:EE:56:4F:50:12:46:CD:F1:C6:99:75:7A:94:AC:7D:1C:45:23:B7:C1:AA:02:E9:EA:7B:D0:ED:D8:EF",
        // Upload key — so a build installed straight from EAS verifies too.
        "D3:F7:FF:6B:9B:F4:3F:9B:EE:CF:69:0A:7B:EC:EB:C9:E6:E4:31:A7:8A:EE:83:D4:8F:E8:AA:FB:E8:00:5C:79",
      ],
    },
  },
];

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(JSON.stringify(STATEMENTS, null, 2), {
    headers: { "content-type": "application/json" },
  });
}

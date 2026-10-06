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
 * **The fingerprint is Play's own APP SIGNING key**, filled in 2026-10-06 after
 * the first upload, from Play Console -> Protected with Play -> Play Store
 * distribution -> Play app signing. With Play App Signing that key is Google's,
 * not ours, and it is what signs the APK a user actually installs — the EAS
 * UPLOAD key is a different certificate and listing it alone would verify
 * nothing for anybody who installed from the store.
 *
 * **A build sideloaded from EAS needs its own entry here**, because it is signed
 * by whatever certificate EAS used rather than by Play's. Add it as a second
 * element; several fingerprints is the normal shape of this file, not a
 * workaround. Read it off the artefact itself — `apksigner verify --print-certs`
 * on the downloaded .apk — rather than off a screen, because the certificate
 * that signed the file is the only thing Android compares against.
 *
 * ⚠️ A wrong or missing fingerprint fails **silently**: the link just opens the
 * browser, with nothing logged on the device or here. See NOTES.md,
 * "App-link association files", for how to verify after a deploy.
 */
const STATEMENTS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.irithmetic.consignmentwarehouse",
      sha256_cert_fingerprints: [
        "D3:F7:FF:6B:9B:F4:3F:9B:EE:CF:69:0A:7B:EC:EB:C9:E6:E4:31:A7:8A:EE:83:D4:8F:E8:AA:FB:E8:00:5C:79",
        "F2:3F:2C:EE:56:4F:50:12:46:CD:F1:C6:99:75:7A:94:AC:7D:1C:45:23:B7:C1:AA:02:E9:EA:7B:D0:ED:D8:EF"
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

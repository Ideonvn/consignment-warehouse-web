/**
 * Universal Links: the file iOS fetches from `https://consignment-warehouse.com`
 * before it will ever open an https link in the app.
 *
 * **A route handler rather than `public/`.** Apple requires this file with **no
 * extension** and served as `application/json`; a `public/` file with no
 * extension gets whatever the static layer guesses, which is not that. Here the
 * header is stated outright and cannot drift.
 *
 * It sits under `app/`, not `app/(app)/`, so `AuthGuard` — which is a React
 * component in that group's layout — is not in its path at all. Nothing here is
 * routed through `lib/auth/publicPaths.ts`: that list is about pages a browser
 * renders, and this is a static document.
 *
 * **The team id is filled in, and it is not a constant.** `CFZK4RA928` is the
 * owner's **individual** Apple enrolment, not a company one: moving the app to an
 * Irithmetic Consulting account issues a *different* Team ID, and this file then
 * has to be refilled and redeployed. Universal links stop working in between,
 * silently — a wrong team id produces no error anywhere, the link simply opens
 * the browser. See NOTES.md, "App-link association files".
 */
const APP_ID = "CFZK4RA928.com.irithmetic.consignmentwarehouse";

/**
 * Only the two canonical shareable surfaces. `/`, `/login`, `/search` and
 * `/profile` are deliberately **not** claimed: a link to the front door or to a
 * sign-in belongs in the browser.
 */
const ASSOCIATION = {
  applinks: {
    apps: [],
    details: [
      {
        appIDs: [APP_ID],
        appID: APP_ID,
        components: [
          { "/": "/lots/*", comment: "A lot — the link people paste into WhatsApp" },
          { "/": "/auctions/*", comment: "An auction and its lots" },
        ],
        paths: ["/lots/*", "/auctions/*"],
      },
    ],
  },
};

// Nothing here is per-request, and iOS fetches it from Apple's CDN anyway.
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(JSON.stringify(ASSOCIATION, null, 2), {
    headers: { "content-type": "application/json" },
  });
}

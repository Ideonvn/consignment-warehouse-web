@AGENTS.md

# Consignment Warehouse — web

The bidder-facing half of an auction platform replacing a business that ran inside WhatsApp groups:
the owner posted a photo, people bid in the thread, an admin closed it by hand. **The admin portal
is a separate repository and is not built here.** This app is the bidder's experience only.

The product is a **stack of cards**, one per lot: swipe left to pass, swipe right to open the bid
sheet. A second screen shows what you're bidding on and whether you're winning. Auction list, lot
detail and profile are deliberately secondary — the stack is the product.

Everything below is real money in someone's hands. A user who is startled by what their tap
committed them to does not come back.

## Stack, and why each piece is here

Locked decisions. Don't swap them out without a reason that survives the one below.

- **Next.js App Router, client-heavy SPA.** The server does routing, layouts and metadata; anything
  touching data is a client component. The access token is memory-only and the live layer is a
  WebSocket, so server-rendering authenticated data buys nothing and costs a lot of plumbing.
- **React Query** — the single place any screen reads server state. REST responses, bid responses
  and socket events all write into the same cache, so no component needs its own socket wiring.
- **zustand** — the two things that aren't server state: the auth session and the realtime
  connection status / per-lot sequence cursors. No provider ceremony.
- **framer-motion** — the gesture layer is the product; hand-rolled drag physics is how it dies.
- **zod** — validates every response at the boundary. `types/api.ts` is `z.infer` over those
  schemas, so a backend change surfaces as one clear parse error instead of `undefined` three
  components deep. Change the schema, not the type.
- **Tailwind v4** with the palette in `app/globals.css`. Dark, high-contrast, photo-first; one
  accent used sparingly. Light/Dark/System is layered on top of it — see Theming, and read that
  before touching a colour.
- **next-themes** — pre-paint theme application; see Theming for why it earns its place.

## Rules that are load-bearing

Each of these has a consequence attached. They are not style preferences.

**A swipe right is NOT a bid.** It records `interested` and opens the confirm sheet. Money moves
only when the user confirms in the sheet. If a swipe ever commits money, an accidental thumb spends
someone's rent. Dismissing the sheet leaves the lot swiped-interested and out of the stack — it is
still reachable from My Bids; do not silently un-swipe it.

**The sheet asks for one number: the most you'll pay.** It sends `amount_minor` =
the server's `minimum_next_bid_minor`, and the user's typed number as `max_amount_minor`. Sending
their number as `amount_minor` would make their ceiling the visible price and overpay instantly.
The backend runs proxy bidding from that ceiling; the sheet says so out loud ("You'll pay only what
it takes to win, up to X"), because a UI that hides it produces users who feel tricked when the
price climbs on its own. Raising an existing maximum goes to `PUT /auto-bid` instead — maximums are
raise-only, validated inline before the server has to refuse.

**`am_i_leading: false` on a *successful* bid is normal, not an error.** A rival's hidden maximum was
higher and the backend counter-bid for them instantly. Say so plainly and offer to raise. Rendering
it as a failure teaches people the app is broken when it is working correctly.

**Money is an integer number of minor units everywhere.** Never float arithmetic. The divide by 100
happens once, at render, in `components/ui/Money.tsx` — the only place money becomes text.

**Token refresh is single-flight** (`lib/api/client.ts`). Parallel 401s must all await one refresh.
Firing several replays a rotated refresh token, which the backend reads as theft and revokes the
entire family — the user is logged out permanently, not transiently. A failed refresh is never
retried; it ends the session.

**The access token lives in memory only.** Never `localStorage`, which any injected script can read.
The refresh token stays in its HttpOnly cookie and is never touched from JS; every request sends
`credentials: "include"` so it flows.

**Countdowns are anchored to server time.** The offset comes from the `Date` header on every
response (`lib/format/clock.ts`); components read `useNow()`, never `Date.now()` during render —
that is both impure (the React Compiler lint enforces it) and a wrong close time on a device with a
skewed clock. One shared ticker drives every countdown.

**`status` is not authoritative for "can I bid".** It labels an *outcome*, so a lot reads `live`
until the lifecycle worker decides how it ended, while any bid past `effective_ends_at` is already
refused with a 409. Gate on the clock via `isLotOpen` (`lib/format/time.ts`). Trusting `status`
puts a live "Place a bid" button on a dead lot.

**`bids.sequence` is gap-free per lot.** Track the highest seen; reconnect with the per-lot
`after_sequences` map so each lot resumes from its own position. On `resync_too_far` you **must**
record `latest_sequence` before refetching — skip it and the tracked sequence stays stale, so every
later bid looks like a fresh gap, asks for a resync, gets refused again, and thrashes for the life
of the page while looking perfectly correct on screen. Replayed duplicates are dropped by sequence
as a safety net; keep it.

**`lot_rescheduled` can move a clock EARLIER.** Unlike `lot_extended` (anti-snipe, later only), an
admin moving the auction's `ends_at` cascades in either direction. Apply the value absolutely; a
countdown that only ever grows is wrong here.

**The reserve amount must never appear in this app.** `reserve_met` is a boolean and is all a bidder
may see. `reserve_price_minor` is admin-only and must not be requested, stored or rendered.

**Never compute `minimum_next_bid_minor` yourself.** It is price-banded and configurable per auction
and per lot — server-owned. Read it from the lot, from the bid response, or from the 422 that tells
you someone bid first.

## Theming

Light / Dark / System, selectable on `/profile`. **Dark is the default and the product's
identity**; light exists for daylight readability and is opt-in.

**The palette is declared twice on purpose.** Raw tokens (`--bg`, `--accent`, ...) live on `:root`,
and `@theme inline` maps them to Tailwind's names (`--color-bg` -> `var(--bg)`). Tailwind resolves
`@theme` statically, so a palette declared directly there cannot be overridden — with the
indirection, one `[data-theme="light"]` block re-points the raw tokens and every existing `bg-bg`,
`text-text` and `border-border` follows. Add new colours as a raw token plus an `@theme inline`
mapping, never as a literal.

**The accent is not a neutrals problem.** `#E8FF5A` is ~1.1:1 against white — invisible. So there
are three accent tokens, and which one you reach for depends on how the colour is used:

| Token | Use | Dark | Light |
|---|---|---|---|
| `--accent` | brand **fills** (buttons, selected tab, logo) | `#E8FF5A` | `#E8FF5A` — unchanged |
| `--accent-text` | accent as **text**, and thin marks that must be seen (focus rings, live dot, toast bar, gallery dot) | `#E8FF5A` | `#5C6B00` — darkened same hue |
| `--accent-edge` | border on a brand fill | `transparent` | `#5C6B00` |

`--accent-edge` is why the lime button still reads as a button on white: the fill itself is only
1.11:1 against a white card, which fails the 3:1 needed for a non-text boundary, so light gives it
an edge instead of abandoning the brand colour. In dark it is transparent and nothing shifts.
`--border-strong` marks control boundaries (inputs) as distinct from decorative card edges; in dark
it equals `--border`, so the shipped look is untouched.

Measured ratios (WCAG AA: 4.5:1 body text, 3:1 large text and non-text boundaries):

| Pairing | Dark | Light |
|---|---|---|
| text on bg / surface / raised | 18.2 / 16.9 / 15.3 | 16.4 / 18.0 / 15.5 |
| muted text on bg / surface / raised | 7.1 / 6.6 / 6.0 | 5.8 / 6.4 / 5.4 |
| accent-text on bg / surface / raised | 17.8 / 16.5 / 15.0 | 5.4 / 5.9 / 5.1 |
| accent-text on the `accent/10` tint | 12.8 | 5.8 |
| accent-ink on the accent fill (button label) | 17.8 | 17.8 |
| danger on bg / surface / tint | 6.5 / 6.0 / 5.4 | 6.0 / 6.6 / 5.6 |
| success on bg / surface / tint | 11.4 / 10.6 / 8.8 | 6.7 / 7.3 / 6.3 |
| accent fill vs surface (button edge) | 16.5 | 1.11 -> `--accent-edge` at 5.9 |
| input border vs its fill | 1.16 (see below) | 3.12 |

Two were caught by measuring and fixed before shipping: light `success` at `#15803D` scored 4.38 on
its own tint (below 4.5, now `#146B33`), and the light accent fill needed the edge token. **Card
photos:** light surfaces are neutral white so lot photography still dominates — that is why dark was
chosen originally and the light theme must not tint it away.

**Known deviation:** the *decorative* card border is ~1.3:1 in both themes, and the dark input
border is 1.16:1 — both pre-date theming and are unchanged here. Light inputs use `--border-strong`
because they would otherwise be imperceptible; raising dark's `--border-strong` to ~`#6C6F78` would
close the dark gap, and is a one-line change if wanted.

**No flash of the wrong theme.** `next-themes` injects a script that sets `data-theme` before first
paint — a dark-mode user must never see a white flash. It also handles the OS theme changing while
the app is open, cross-tab sync, and the SSR/client mismatch (hence `suppressHydrationWarning` on
`<html>`). `enableColorScheme` keeps the CSS `color-scheme` in step so native controls, scrollbars
and autofill follow. `viewport.themeColor` can only vary by media query, which follows the OS, so
`ThemeProvider` rewrites the `theme-color` meta to the resolved theme's background — otherwise an
explicit Light choice on a dark OS keeps a black status bar. The theme change is deliberately not
animated: a whole-page cross-fade is jarring and costly.

## Structure

- `app/` — routes. `(app)/` is everything behind the sign-in wall (guard, bottom nav, realtime
  provider); `login/` and `welcome/` sit outside it.
- `components/` — UI primitives (`ui/`) plus feature components grouped by surface.
- `lib/api/` — typed client, endpoints, zod schemas, error classes, query keys, cache writers.
- `lib/auth/` — session store, device id, login flow state.
- `lib/realtime/` — socket client, event→cache reducer, connection/sequence store.
- `lib/format/` — money, time, lot status. Pure functions; they take `now` rather than reading it.
- `lib/hooks/` — shared hooks (stack paging, subscriptions, ticker, bid submission).
- `types/` — API types inferred from the zod schemas.

Three files carry most of the risk and are worth reading before changing anything nearby:
`lib/api/client.ts`, `components/bid/BidSheet.tsx`, `lib/realtime/socket.ts`.

## Running it

```bash
npm run dev         # http://localhost:3000
npm run build
npm run lint
npm run typecheck   # tsc --noEmit
```

The backend must be running from its own repo with **`make dev-all`** (API *and* the lifecycle
worker — without the worker no lot ever opens, closes or extends, and the realtime lifecycle events
never fire) plus **`make seed`**. Copy `.env.example` to `.env.local`.

While the backend runs with `APP_ENV=local` the **OTP code is always `0000`**. Seeded bidders:
`+27820000002`, `+27820000003`, `+27820000004`; admin `+27820000001`. Numbers must be full E.164 —
the backend does not infer a country from `082…`.

Note the rate limits when scripting against it: OTP requests are capped per number *and* per IP
(a heavy test run will lock you out for the best part of an hour), and bids are capped at 60/min
per lot.

## Guardrails

- **No new dependencies** without a reason that maps to the stack above. No component library —
  build the primitive.
- `next-themes` is the one dependency added outside the original stack: it exists for the
  pre-paint script, OS-change handling, cross-tab sync and SSR agreement, all of which are easy to
  hand-roll incorrectly.
- **Never put the access token in storage**, and never read the refresh token from JS.
- **Never compute `minimum_next_bid_minor`, or reveal a reserve amount.**
- **Don't create git commits.** Stage the work and let the developer review it.
- Verify against the running backend, don't reason about it. Every bug worth finding here was found
  by driving the real thing (see NOTES.md).

## Known gaps

Accepted, with reasons. Please don't re-raise them.

- **`SwipedList` fetches the auctions list to resolve currency.** Lot cards carry `auction_id` but no
  `currency_code`, and `/me/swipes` spans auctions by design. The extra fetch is intentional: ZAR is
  expected to remain the only currency, so this costs one cached request rather than a schema
  change, and money still renders from the auction's own currency instead of a hardcoded symbol.
- **The theme preference is `localStorage` only, never synced to the backend.** Theme is genuinely
  per-device — the same person wants dark on a phone at night and light on a laptop in daylight — so
  syncing it across devices would be wrong behaviour, not a missing feature. Do not "fix" this by
  adding a user field.
- **Lot pages have static metadata.** Per-lot titles would need authenticated server rendering,
  which conflicts with the memory-only access token.
- **Bid history refetches rather than splicing** a new bid into page one. Simpler and always
  correct; one small request per bid, on the lot detail screen only.
- **Image optimization is off** (`next.config.ts`) until the media host is settled — lot photos come
  from whatever host the backend serves, and a `remotePatterns` allowlist breaks silently on a new
  one.

`NOTES.md` holds the longer record: judgement calls, backend requests, and the end-to-end
verification runs including the bugs they caught.

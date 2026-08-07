# Build prompt: Consignment Warehouse — consumer web application

Paste this whole file into Claude Code running in `consignment-warehouse-web`, or run
`claude "Read BUILD-PROMPT.md and execute it end to end."`

---

## Your role

You are a senior frontend engineer building a **real-money auction application**. You have shipped
gesture-driven mobile web before and you know where it goes wrong: swipes that fire twice, a
countdown that drifts against the server, a socket that reconnects and silently misses events, a
double-tapped confirm button that places two bids.

This is money. A user who is startled by what their tap committed them to does not come back.

You are working alone, in one long run, with no one watching. That changes how you work:

- **Never stop to ask permission.** Where this document leaves a genuinely free choice, make the
  call that best serves the product, note it, and keep going. Only stop if you are truly blocked —
  a missing backend, a contradiction you cannot resolve — and if you stop, say exactly what you
  need.
- **Never leave the codebase broken between milestones.** Each milestone ends with a green
  typecheck, lint, and production build. If a gate fails, fix it before starting the next
  milestone. Do not accumulate errors and clean up at the end; that is how a long run turns into
  ten milestones of compounding damage.
- **Never stub something and move on silently.** If you defer something, put it in a running
  `NOTES.md` under "Deferred", with the reason.
- Work through the milestones in order. Do not skip ahead and do not reorder them.
- **Do not create git commits.** Git is not configured for this project; leave the working tree
  alone.

## What you are building

**Consignment Warehouse** is an auction platform replacing a business currently run inside WhatsApp
groups: the owner posts a photo and description, people bid in the thread, an admin closes it by
hand. This is the consumer-facing web application — the bidder's experience. The admin portal is a
separate project and **is not your concern**.

The backend is complete and running. You will not modify it. If you believe the API is wrong or
missing something, record it in `NOTES.md` under "Backend requests" and work around it.

### The core interaction

The app is **gesture-first**. The main screen is a stack of cards, one per lot (a "lot" is a single
item in an auction). Each card shows the photo, the title, the current bid, and a countdown.

- **Swipe left** = not interested. The lot leaves the stack but is recoverable from a "Passed" view.
- **Swipe right** = open the bid confirm sheet. **A swipe right is NOT a bid.** The bid exists only
  after the user confirms in the sheet. This distinction is load-bearing: an accidental swipe must
  never commit money.

There is a second screen showing lots the user is bidding on and whether they are winning.

Everything else — auction list, lot detail, bid history, profile — is secondary and should feel
like it. The stack is the product.

## Locked decisions — implement these, do not reconsider

**Architecture: client-heavy SPA inside the Next.js App Router.** A thin server shell; all
interactive surfaces are client components. Authentication is a Bearer token held in memory and the
live layer is a WebSocket, so server-side rendering of authenticated data buys nothing here and
costs a lot of plumbing. Use the App Router's file conventions for routing and layouts, and do the
data work client-side.

**Visual direction: dark, high-contrast, photo-first.** Detailed below.

**Bid input: a single "maximum you'll pay" field.** Detailed below. This is the most important UX
decision in the app — read that section twice.

**Verification: typecheck, lint and production build after every milestone.**

## Stack

Already present: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, ESLint.

Add only what you need. These are pre-approved:

- `@tanstack/react-query` — server state, caching, mutations. The app is read-heavy with live
  invalidation; hand-rolling this would be worse.
- `zustand` — auth session and socket state. Small, no provider ceremony.
- `framer-motion` — swipe gestures, card physics, sheet transitions. The gesture layer is the
  product; do not hand-roll drag physics.
- `zod` — runtime validation at the API boundary, so a schema drift surfaces as a clear error
  rather than an undefined deep in a component.
- `clsx` + `tailwind-merge` — class composition.

Do not add a component library (no MUI, Chakra, shadcn). Build the handful of primitives you need.
Do not add a date library; the app needs relative countdowns only and `Intl` covers formatting.

## The backend API — complete reference

**Base URL:** `http://localhost:8000/api/v1`, from `NEXT_PUBLIC_API_BASE_URL`.
**WebSocket:** `ws://localhost:8000/api/v1/ws`, from `NEXT_PUBLIC_WS_URL`.

Create `.env.local` with both, and `.env.example` documenting them.

### Conventions that apply everywhere

- **All money is an integer in minor units (cents).** A field named `*_minor` is cents. Never do
  float arithmetic on it. `250000` is R2 500,00. Format with `Intl.NumberFormat` using the
  auction's `currency_code` (ISO 4217; expect `ZAR`) and divide by 100 only at the render step.
- **All timestamps are ISO 8601 UTC strings.** Parse to `Date`. Never assume the user's clock is
  correct — see the countdown section.
- **All IDs are UUID strings.**
- Authenticated endpoints take `Authorization: Bearer <access_token>`. Everything below requires
  it except the OTP endpoints.
- Errors are `{"detail": "..."}` unless documented otherwise. Two endpoints return a structured
  `detail` object — bid-too-low and frozen-field. Handle both shapes.
- Every `429` carries a `Retry-After` header in seconds. Use it; do not invent your own backoff.
- List endpoints that paginate by cursor return `X-Next-Cursor` and `X-Has-More` headers. These are
  exposed via CORS, so you can read them. An empty `X-Next-Cursor` means no more pages.

### Authentication

The backend is phone-first with OTP. **While the backend runs with `APP_ENV=local`, the OTP code is
always `0000`** — you do not need to read it from logs.

Seeded test accounts (created by `make seed` in the backend): bidders `+27820000002`,
`+27820000003`, `+27820000004`; admin `+27820000001`. Use a bidder.

#### `POST /auth/otp/request`

Request: `{ "phone": string }` — must be E.164, e.g. `+27821234567`. The backend does **not** infer
a country from a local format like `082...`, so your input must produce a `+` prefixed number.

Response `200`: `{ "detail": "If the number is valid, a code has been sent." }` — deliberately
identical whether or not the number is registered. **Do not build any UI that implies you know
whether an account exists.**

Errors: `422` invalid phone format. `429` rate limited (5/hour per number, 10/hour per IP, 3 per
60s per IP) with `Retry-After`.

#### `POST /auth/otp/verify`

Request:
```json
{ "phone": "+27821234567", "code": "0000", "device_id": "<stable uuid>", "device_name": "Chrome on macOS" }
```

`device_id` must be **stable per browser** — generate a UUID on first run and persist it in
`localStorage`. It identifies the token family; a new one on every load would leave orphaned
sessions.

Response `200`:
```json
{ "access_token": "<jwt>", "refresh_token": "<opaque>", "token_type": "bearer", "expires_in": 900 }
```

The refresh token is **also** set as an `HttpOnly` cookie. On web, prefer the cookie and do not
store the refresh token in JS. Hold the **access token in memory only** — never `localStorage`,
which is readable by any injected script.

Errors: `401` wrong/expired/consumed code. `403` account suspended. `429`.

A new user is created on first successful verify, with `first_name`/`last_name` null. Detect that
and route them to a short "what should we call you?" step.

#### `POST /auth/refresh`

Request: `{}` on web — the cookie carries it. (`{ "refresh_token": "..." }` is for mobile.)

Response: same shape as verify. **The refresh token rotates on every call.**

Errors: `401` — unknown, expired, or **already used**. A replayed token means theft, and the
backend revokes the entire family. Treat any `401` here as "session over": clear state and send the
user to login. Never retry a failed refresh.

**Concurrency matters here.** Several requests can 401 at once when the access token expires. Your
client must run **at most one refresh at a time** and have the other requests await that single
promise, then retry once. Firing three refreshes in parallel means two of them replay a rotated
token and kill the session.

#### `POST /auth/logout?all_devices=false`

Request: `{}` (cookie). Authenticates on the **refresh token alone** — no access token needed, by
design, since access tokens last 15 minutes and refresh tokens 60 days.

Response `200`: `{ "detail": "logged out" }`. Errors: `401`.

#### `GET /auth/me` → `200`

```json
{
  "id": "uuid", "phone_e164": "+27821234567", "first_name": "string|null",
  "last_name": "string|null", "email": "string|null", "status": "active|suspended|deleted",
  "role": "bidder|admin|superadmin", "is_phone_verified": true,
  "last_login_at": "iso|null", "created_at": "iso"
}
```

#### `PATCH /auth/me`

Request (all optional): `{ "first_name": string|null, "last_name": string|null, "email": string|null }`.
Response: `UserOut`. Errors: `409` email already in use, `422` invalid email.

### Auctions

#### `GET /auctions?status=&limit=50&offset=0` → `200` array of:

```json
{
  "id": "uuid", "slug": "string", "name": "string", "description": "string|null",
  "image_url": "string|null", "status": "draft|scheduled|live|ended|settled|cancelled",
  "starts_at": "iso", "ends_at": "iso", "currency_code": "ZAR",
  "anti_snipe_window_seconds": 300, "anti_snipe_extension_seconds": 300, "max_extensions": 20
}
```

Offset paginated (not cursor). Drafts are never returned to a bidder. `status` filters server-side.

#### `GET /auctions/{auction_id}` → same object. `404` if missing or draft.

### Lots — the card stack

#### `GET /auctions/{auction_id}/lots`

Query: `include_swiped` (bool, default `false`), `direction` (`pass`|`interested`), `cursor` (int —
the `lot_number` to resume **after**), `limit` (1–100, default 20).

**Default behaviour returns only lots this user has not yet swiped**, ordered by `lot_number`. That
is exactly the card stack. Pass `direction=pass` for the "Passed" view, `direction=interested` for
lots they swiped right on.

Response `200`, array of:
```json
{
  "id": "uuid", "auction_id": "uuid", "lot_number": 1, "title": "string",
  "status": "draft|scheduled|live|ended_sold|ended_unsold|ended_reserve_not_met|withdrawn|cancelled",
  "starting_price_minor": 250000, "current_bid_minor": 300000, "minimum_next_bid_minor": 305000,
  "bid_count": 4, "bid_sequence": 6, "effective_ends_at": "iso", "extension_count": 1,
  "reserve_met": false, "primary_image_url": "string|null", "my_swipe": "pass|interested|null"
}
```

Headers: `X-Next-Cursor` (a `lot_number`), `X-Has-More`.

Notes you must respect:
- `current_bid_minor` is `null` when there are no bids. Show the starting price instead.
- `minimum_next_bid_minor` is **computed server-side** with price-banded increments. Never compute
  it yourself — the bands change with price and are configurable per auction and per lot.
- `reserve_met` is a boolean. **The reserve amount is never sent to bidders and must never appear
  in your UI.**
- `effective_ends_at` is the real close time and moves when anti-snipe fires.

#### `GET /lots/{lot_id}` → the card object plus:

```json
{
  "description": "string|null", "scheduled_ends_at": "iso",
  "images": [{"id":"uuid","url":"string","position":0,"is_primary":true,"width":null,"height":null}],
  "my_auto_bid_max_minor": 500000,
  "am_i_leading": true
}
```

`my_auto_bid_max_minor` is **this user's own** maximum — always safe to show them, never anyone
else's. `404` if the lot is missing or in a draft auction.

#### `GET /lots/{lot_id}/bids?cursor=&limit=50`

Newest first. `cursor` is a `sequence` to resume **before**. Response array of:
```json
{
  "id":"uuid","sequence":6,"amount_minor":305000,
  "status":"active|outbid|winning|won|retracted|void","is_auto":false,
  "created_at":"iso","bidder_handle":"Bidder 872072","is_mine":false
}
```

`bidder_handle` is pseudonymous and stable. `is_auto` means the backend's proxy engine placed it on
someone's behalf — worth showing subtly, it explains why the price moved without a person acting.

### Swipes

#### `PUT /lots/{lot_id}/swipe`

Request: `{ "direction": "pass" | "interested" }`. Upsert — re-swiping is fine and never errors.

Response `200`: `{ "lot_id": "uuid", "direction": "pass", "updated_at": "iso" }`.

#### `DELETE /lots/{lot_id}/swipe` → `204`

Idempotent: deleting a swipe that does not exist is still `204`. This is your "undo".

### Bidding — the critical path

#### `POST /lots/{lot_id}/bids`

Request:
```json
{ "amount_minor": 305000, "max_amount_minor": 500000, "client_request_id": "<uuid v4>" }
```

- `amount_minor` — the visible bid. **Always send `minimum_next_bid_minor`** (see the bid UX
  section for why).
- `max_amount_minor` — optional, must be `>= amount_minor`. The user's secret ceiling.
- `client_request_id` — **required idempotency key.** Generate one UUID per confirm-sheet opening
  and reuse it for retries of that same intent. A double-tapped button or a network retry sending
  the same id returns the original result instead of bidding twice. **Generate a new one only when
  the user starts a genuinely new bid.**

Response `200`:
```json
{
  "lot_id":"uuid","accepted":true,"is_replay":false,"am_i_leading":true,
  "current_bid_minor":310000,"minimum_next_bid_minor":315000,"my_max_minor":500000,
  "bid_count":5,"bid_sequence":8,"effective_ends_at":"iso","extension_count":2,
  "extended":true,
  "bids":[ ...BidOut... ]
}
```

This response contains **everything needed to update the UI without a refetch** — including
`effective_ends_at`, so the countdown corrects the instant anti-snipe fires. Use it.

`is_replay: true` means this was an idempotent retry. Treat it as success, silently.

**`am_i_leading` can be `false` on a successful bid.** This is not an error and it is the single
most important thing to communicate well. If a rival's hidden maximum is higher, the backend
instantly counter-bids for them and the user is outbid before the sheet closes. Say so plainly:
*"You've been outbid — someone has a higher maximum. Current bid R3 150."*

Errors:
- `422` with structured detail — the bid was below the minimum:
  ```json
  { "detail": { "message": "bid is below the minimum", "minimum_next_bid_minor": 315000 } }
  ```
  **Read `minimum_next_bid_minor` out of the error, update the field, and let them retry.** This
  happens legitimately whenever someone else bid between render and submit.
- `409` — lot is closed. The clock ran out. Refresh the lot and tell them.
- `403` — not eligible to bid on this lot.
- `429` — rate limited (60/min per lot, 180/min overall) with `Retry-After`.
- `404` — lot not found.

#### `PUT /lots/{lot_id}/auto-bid`

Request: `{ "max_amount_minor": 600000, "client_request_id": "<uuid>" }`. Same response shape.

**Maximums are raise-only.** Lowering returns `422`. Say that clearly in the UI before they submit.

Raising your maximum while already leading **does not move the price and emits no event to anyone**
— by design, so rivals learn nothing. The response will show an unchanged `current_bid_minor`; do
not treat that as a failure.

#### `DELETE /lots/{lot_id}/auto-bid` → `204`

Stops future automatic counter-bidding. **Does not retract any bid already placed.** Word this
carefully — it is not an undo.

#### `GET /me/bids?active_only=false&limit=50`

The second screen. Array of:
```json
{
  "lot_id":"uuid","auction_id":"uuid","lot_number":3,"title":"string","status":"live",
  "current_bid_minor":310000,"minimum_next_bid_minor":315000,"effective_ends_at":"iso",
  "primary_image_url":"string|null","my_max_minor":500000,"my_highest_bid_minor":305000,
  "am_i_leading":false,"is_open":true
}
```

Ordered by closing time. `active_only=true` returns only lots still open.

### Real-time

#### `POST /ws/ticket` → `200` `{ "ticket": "<opaque>", "expires_in": 30 }`

Requires a Bearer token. The ticket is **single-use and valid 30 seconds**. Errors: `429`
(300/hour) with `Retry-After`.

#### `WS /ws?ticket=<ticket>`

Mint a fresh ticket immediately before every connection attempt, including every reconnect. A
reused or expired ticket closes with code **4401** before accepting — on 4401, mint a new ticket
and retry; do not treat it as a permanent failure unless it repeats.

**Client → server** (JSON text frames):

| Message | Notes |
|---|---|
| `{"action":"subscribe","lot_ids":["uuid",...]}` | Optional `"after_sequence": N` replays missed bids for those lots in the **same round trip** — always use it on reconnect. |
| `{"action":"unsubscribe","lot_ids":[...]}` | |
| `{"action":"resync","lot_id":"uuid","after_sequence":N}` | |
| `{"action":"ping"}` | |

**Server → client:**

| Message | Meaning |
|---|---|
| `{"type":"subscribed","lot_ids":[...]}` / `{"type":"unsubscribed","lot_ids":[...]}` | Confirmation. Only the accepted ids. |
| `{"type":"bid","lot_id","sequence","amount_minor","bidder_handle","bid_count","is_auto","created_at"}` | A visible bid landed. |
| `{"type":"lot_extended","lot_id","effective_ends_at","extension_count"}` | Anti-snipe fired — update the countdown. |
| `{"type":"lot_rescheduled","lot_id",...}` | An admin moved the auction's clock. |
| `{"type":"lot_closed","lot_id","status","current_bid_minor"}` | The lot ended. |
| `{"type":"lot_opened","lot_id","status"}` | The lot went live. |
| `{"type":"resync_complete","lot_id","latest_sequence","effective_ends_at","status","current_bid_minor"}` | Replay finished, with current state. |
| `{"type":"resync_too_far","lot_id",...}` | Gap beyond 200 events — refetch the lot over REST instead. |
| `{"type":"pong"}` / `{"type":"ping"}` | Reply to yours / server heartbeat — **you must reply to a server ping.** |
| `{"type":"error","code","detail"}` | Codes: `bad_json`, `bad_message`, `unknown_action`, `bad_lot_ids`, `bad_resync`, `unknown_lot`, `too_large`, `rate_limited`, `subscription_limit`. |

Limits: 200 lots per connection, 4 KB per message, 120 messages/minute, 120s idle timeout, 30s
server ping.

**`sequence` is a gap-free per-lot ordinal.** Track the highest seen per lot. On reconnect,
subscribe with `after_sequence` set to it and you will receive exactly what you missed. If you ever
receive a `sequence` more than one above your tracked value, you have a gap — resync that lot rather
than rendering a hole in the history.

## The bid confirm sheet — read this twice

The backend persists **every** bid as a proxy ceiling. Bid R500 on a lot sitting at R100 and you
become the leader at **R100**, with a hidden maximum of R500. The system bids on your behalf, one
increment at a time, up to that ceiling. This is standard proxy bidding and it is correct — but a
UI that hides it produces users who feel tricked when the price climbs without them touching
anything.

So the sheet asks for **one number: the most you are willing to pay.**

Layout, top to bottom: the lot photo and title; the current state (`Current bid R3 000` or
`Starting at R2 500 · no bids yet`); the input, labelled **"Your maximum"**, prefilled with
`minimum_next_bid_minor` and with quick-add chips (+1, +2, +5 increments computed from the gap
between `current_bid_minor` and `minimum_next_bid_minor`); then, prominently, the explainer:

> **You'll pay only what it takes to win, up to R500.**
> We bid for you automatically. Right now that means **R3 050**.

That second line must recompute live as they type. Then a single confirm button reading
**"Confirm — up to R500"**, never just "Bid".

On submit, send `amount_minor: minimum_next_bid_minor` and `max_amount_minor: <their number>`. Do
not send their number as `amount_minor` — that would make their ceiling the visible price and
overpay immediately.

Validation before sending: their number must be `>= minimum_next_bid_minor`. If they already have
an auto-bid on the lot (`my_auto_bid_max_minor`), it must be **strictly greater** — maximums are
raise-only — and say so inline rather than letting the server reject it.

Outcomes to handle distinctly:

- **Leading** (`am_i_leading: true`) — confirm clearly: *"You're winning at R3 050."* Show their
  ceiling so it stays front of mind.
- **Outbid immediately** (`am_i_leading: false`) — *"Outbid — someone's maximum is higher. Now at
  R5 200."* Offer to raise. Never make this feel like an error state; it is a normal auction
  outcome.
- **Below minimum** (`422`) — someone bid first. Update the minimum from the error, keep the sheet
  open, explain in one line.
- **Closed** (`409`) — *"Bidding closed on this lot."* Close the sheet, refresh the card.

The confirm button must be **disabled while the request is in flight**, and the same
`client_request_id` reused for any retry of that same intent.

## Design system

**Dark, high-contrast, photo-first.** The photo is the hero; chrome recedes. Define these as CSS
variables in `globals.css` and use them via Tailwind v4's `@theme`.

```
--bg:            #0A0A0B   near-black canvas
--surface:       #141416   cards, sheets
--surface-raised:#1E1E21   inputs, chips
--border:        #2A2A2E
--text:          #F5F5F6
--text-muted:    #9A9AA2
--accent:        #E8FF5A   acid yellow-green — bids, primary CTAs, the live pulse
--accent-ink:    #0A0A0B   text on accent
--danger:        #FF5A5A   outbid, closed, errors
--success:       #4ADE80   winning
```

One accent, used sparingly — for the current bid figure, the primary action, and the live
indicator. When everything is accented nothing is.

**Type:** system font stack. Prices are the loudest thing on screen — large, tabular numerals
(`font-variant-numeric: tabular-nums`) so digits do not jitter as they tick. Titles one step below.
Metadata small and muted.

**Motion:** meaningful, never decorative. Cards follow the finger 1:1 with rotation proportional to
horizontal offset; release past threshold flies out in that direction, below it springs back. Sheets
slide from the bottom. A price change pulses the accent briefly rather than swapping instantly —
that pulse is how a user notices they have been outbid while looking at the screen. Respect
`prefers-reduced-motion`: keep state changes, drop the flourish.

**Mobile-first.** Design at 390px and let it scale up; a phone in a WhatsApp group is the real
device. Bottom navigation, thumb-reachable actions, generous hit targets (44px minimum). On desktop,
centre the stack in a phone-width column rather than stretching it.

## Milestones

Each ends with the verification gate. Do not start the next until the current one is green.

### M0 — Foundation

Install dependencies. Set up `.env.local` / `.env.example`. Configure Tailwind theme tokens and
`globals.css`. Create the folder structure:

```
app/                 routes (App Router)
components/          ui primitives + feature components
lib/api/             typed client, endpoint functions, zod schemas
lib/auth/            session store, token refresh, device id
lib/realtime/        socket client, subscription manager, event reducer
lib/format/          money, countdown, relative time
lib/hooks/           shared hooks
types/               shared types
```

Write **`types/api.ts` covering every response shape in this document**, and matching zod schemas.
This is the contract; get it right once and the rest follows.

Build the API client: base URL from env, `Authorization` injection, JSON handling, typed errors
distinguishing `{detail: string}` from the structured bid-too-low and frozen-field shapes, reading
`X-Next-Cursor` / `X-Has-More`, and honouring `Retry-After` on 429.

Implement the **single-flight refresh**: on 401, one refresh at a time, other calls await it, retry
once, and on refresh failure clear the session and redirect to login. Get this right now — it is
painful to retrofit.

**Gate:** `tsc --noEmit`, `eslint`, `next build` all clean.

### M1 — Authentication

Routes: `/login` (phone entry), `/login/verify` (OTP), `/welcome` (name capture for new users).

Phone input defaulting to `+27` with clear formatting guidance — the backend requires E.164 and will
not infer a country. A stable `device_id` in `localStorage`. Access token in memory only. OTP input
as 4–6 separate boxes with paste support and auto-submit on completion. Resend with a countdown
driven by `Retry-After`. Route users with no `first_name` to `/welcome`.

An auth guard component that redirects unauthenticated users to `/login`, preserving their intended
destination.

**Gate:** as above, plus manually confirm a full login against the running backend with `0000`.

### M2 — App shell

Root layout, bottom navigation (Stack / My Bids / Profile), the dark theme applied, safe-area
insets, loading and error boundaries, a toast system for transient feedback, and shared primitives:
`Button`, `Sheet`, `Input`, `Skeleton`, `EmptyState`, `Countdown`, `Money`.

`Money` takes minor units and a currency code and is the **only** place formatting happens.
`Countdown` takes an ISO string and renders a live-ticking remainder.

**Gate.**

### M3 — Auctions

`/` lists auctions — live first, then scheduled, then ended. Each shows name, image, status, lot
count if derivable, and a countdown. Tapping a live auction enters its stack.

**Gate.**

### M4 — The card stack

`/auctions/[auctionId]` — the heart of the app.

Fetch with `GET /auctions/{id}/lots` (unswiped by default), keeping a buffer of upcoming cards and
prefetching the next page when the buffer runs low. Render 2–3 cards deep with the ones behind
slightly scaled and offset.

Drag with framer-motion: 1:1 tracking, rotation proportional to offset, left/right intent shown as
the card moves ("Pass" / "Bid"). Past threshold, fly out; below it, spring back. Keyboard support:
left/right arrows, and a visible pair of buttons for anyone who does not want to swipe.

On swipe left: `PUT /swipe {direction:"pass"}` optimistically, advance the stack. On swipe right:
`PUT /swipe {direction:"interested"}` **and open the confirm sheet** — the swipe records intent, the
sheet takes the money.

If the sheet is dismissed without confirming, the lot stays swiped-interested and leaves the stack;
it remains reachable from My Bids' "interested" view. Do not silently un-swipe.

Each card shows: photo (with a graceful placeholder when `primary_image_url` is null), title,
current bid or starting price, bid count, countdown, and a subtle "reserve not met" marker when
`reserve_met` is false and bids exist.

Undo the last swipe via `DELETE /lots/{id}/swipe`, restoring the card to the front.

Empty state when the stack is exhausted, offering the passed pile.

**Gate.**

### M5 — Bid confirm sheet

Build exactly as specified in the bid section above. Include all four outcome states, in-flight
disabling, `client_request_id` lifecycle, and inline raise-only validation.

**Gate.**

### M6 — Lot detail

`/lots/[lotId]` — full-bleed image gallery (swipeable, dot indicators), title, description,
current bid, minimum next bid, countdown, `reserve_met` indicator, `am_i_leading` state, the user's
own maximum with a control to raise it or cancel auto-bidding (with clear wording that cancelling
does not retract bids), and bid history from `GET /lots/{id}/bids` — paginated, own bids marked,
auto-bids subtly distinguished.

**Gate.**

### M7 — My bids

`/my-bids` — from `GET /me/bids`, grouped into Winning / Outbid / Ended, with a filter for open
lots only. Each row: photo, title, current bid, their maximum, countdown, and a clear
winning/outbid indicator. Outbid rows offer a one-tap raise. A tab or filter for lots swiped
`interested` but never bid on, and a "Passed" view from `direction=pass` allowing un-passing.

**Gate.**

### M8 — Real-time

`lib/realtime/`: a singleton socket client that mints a ticket, connects, and manages subscriptions.

- Exponential backoff with jitter on disconnect, capped around 30s; mint a fresh ticket each attempt.
- Track the highest `sequence` per lot; reconnect via `subscribe` with `after_sequence`.
- Handle `resync_too_far` by refetching the lot over REST.
- Reply to server `ping` with `pong`; treat 120s of silence as dead and reconnect.
- Subscribe to the lots currently on screen; unsubscribe as they leave. Respect the 200-lot cap.
- Feed events into React Query's cache so components update without their own socket wiring.
- On `bid`: update the lot's current bid, count, sequence; pulse the price; if it displaces the
  user, surface an outbid toast. On `lot_extended` / `lot_rescheduled`: update the countdown. On
  `lot_closed`: mark it closed and stop the clock.
- A connection indicator that is quiet when healthy and honest when not.

**Gate**, plus verify live: two browser windows, bid in one, watch the other update.

### M9 — Polish

Countdowns must be **server-anchored**: compute the offset between server time and local time from
a response `Date` header at startup and apply it to every countdown. A user with a skewed clock must
not see a wrong close time on a lot they are bidding on.

Loading skeletons everywhere (never a spinner on a full page), meaningful empty states, an offline
banner with automatic recovery, error boundaries with a retry, `prefers-reduced-motion` respected
throughout, focus management in sheets, real page titles and metadata, and an app icon/manifest.

Verify keyboard-only operation of every flow, and check contrast against WCAG AA — the dark palette
above should pass, but confirm rather than assume.

**Gate.**

### M10 — Final verification

Run the full gate, then walk the entire journey against the running backend and record the result in
`NOTES.md`: log in with `0000` → browse auctions → enter a stack → swipe left → swipe right →
confirm a bid → see it in My Bids → open lot detail → raise the maximum → in a second window bid
higher as another seeded bidder → confirm the first window updates live and shows outbid → let a
lot close → confirm it renders as ended.

Write `README.md`: what this is, prerequisites (the backend running with `make dev` and `make seed`),
setup, environment variables, scripts, and the architecture in a paragraph.

## Definition of done

1. `npx tsc --noEmit` clean.
2. `npm run lint` clean.
3. `npm run build` succeeds with no errors.
4. Every milestone's screens exist and work against the live backend.
5. The full journey in M10 completes, with the result written into `NOTES.md`.
6. No `any` in application code except where a third-party type forces it, commented.
7. No `TODO` left unrecorded — anything deferred is in `NOTES.md` with a reason.
8. `.env.example` documents every variable.
9. No git commits created.

## Report at the end with

- What you built, milestone by milestone.
- Every judgement call you made where this document left the choice open.
- Anything in the API that fought you, or that you would ask the backend to change.
- What you deferred and why.
- The M10 journey result, honestly — including anything that did not work.

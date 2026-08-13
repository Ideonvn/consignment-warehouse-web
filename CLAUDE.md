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
record `latest_sequence` before refetching — skip it and the resume point stays stale, so every
reconnect asks to resume from the same refused position, gets refused again, and pays for a full
REST refetch each time, for the life of the page and while looking perfectly correct on screen.
Measured, by reverting it: three reconnects, three refusals, resume point pinned. It is *not* every
subsequent bid that suffers — the `bid` branch notes the sequence unconditionally, so one bid event
repairs the position on its own. That is why a quiet lot on a flapping connection is the worst case,
not a busy one. Replayed duplicates are dropped by sequence as a safety net; keep it.

**Full-height layouts use `dvh` — never `vh`, and never a percentage height against `<html>`.**
Both of those resolve against the *large* viewport, the one that assumes the mobile URL bar has
collapsed. The card stack sets `touch-none` so the browser can claim no scroll gesture, which means
the bar may never collapse: the small viewport is the permanent state, and `h-full` on `<html>` had
the shell sizing itself to a viewport the user never has. That is what pushed the swipe buttons
under the bottom nav. Any new full-height screen inherits the same trap, so `min-h-dvh` on `<body>`
is the baseline and nothing above it re-introduces `h-full`.

Two tokens in `app/globals.css` hold that layout together, and they move in pairs:

- `--nav-h` — the bottom nav's height. `AppShell` reserves it as page padding and `CardStack`'s
  action row is `fixed` at `calc(var(--nav-h) + env(safe-area-inset-bottom))`. Change the nav's real
  height without this token and the row lands on top of it.
- `--stack-actions-h` — how much of the card the floating row may cover. `LotCardFace` pads its
  content by exactly this, so the overlap only ever falls on dead space. **The price must never sit
  under a button.** Make the row taller and this grows with it, or the number disappears.

The card area is `min-h-0 flex-1`: when height is short the *card* shrinks, never the buttons, which
stay at 56/48/56 px against a 44 px minimum. Verify any change to either token on a scheduled
auction (the "bidding opens in…" banner costs the most height) at ~360×480.

**A focus ring belongs on the element that carries the corner radius.** Our text fields are a
rounded wrapper around a bare `input`: the wrapper owns the radius, the border and any adornment,
and the input inside has no radius at all, so its own outline drew a square across the rounded
field. The `.field` class in `app/globals.css` hoists the ring to the wrapper and suppresses the
inner one. Two things make this a rule rather than a patch. First, the global `:focus-visible` rule
is **unlayered**, and unlayered CSS beats Tailwind's `@layer utilities` regardless of specificity —
`outline-none` at the call site never had a chance, so opting out has to happen in `globals.css`.
Second, every new adornment variant (currency symbol, country selector) gets it for free. Any new
wrapped field takes `field`; a bare rounded input like the OTP boxes needs nothing.

**A single input that leads to a primary action lives in a `<form>`.** The keyboard's action key is
the natural way to finish, and without a form it does nothing — on a small screen that costs the
user a keyboard dismissal and a scroll. Pair it with `enterKeyHint="go"`. Two constraints: the
submit button keeps its `disabled` guard, which is also what makes the browser refuse implicit
submission while validation fails, and the button itself never goes away — **iOS numeric keypads
frequently have no return key**, so with `inputMode="decimal"` this improves Android and changes
nothing on iOS. `Button` defaults to `type="button"` for the same family of reasons: a bare
`<button>` in a form submits it, so "Resend" next to "Verify" would have fired both.

**Phone entry is hand-rolled, and the wire format is not negotiable.** `PhoneField` shows a country
prefix and groups the national part as it is typed; `lib/auth/phone.ts` composes the E.164 string,
and the spaces never leave the screen. The backend requires strict E.164 and infers no country, so
`0821234567`, `+27 82 123 4567` and `820000002` all have to converge — they do, in `parseEntry`. An
unlisted dial code is the case to be careful with: it resolves to `UNLISTED_COUNTRY`, whose empty
dial prepends nothing, because composing `+27` onto a number that already carries `+678` produced a
wrong number that looked plausible. See that file for why `libphonenumber-js` was measured and
declined, and for what "approximate" means outside the countries with an explicit `groups` pattern.

**A countdown reaching zero must trigger a refetch, not sit at zero.** Expiry changes what the
user may do, but the status that says so is written by the lifecycle worker on its next tick — so
from that moment client and server disagree and only the client knows to resolve it. `useDueRefresh`
schedules a timer for the boundary itself and retries every 5s until the value it was given changes.
Do **not** reach for React Query's `refetchInterval` here: it is only recomputed when the component
re-renders, and these screens don't re-render on the tick — their `Countdown` children do — so the
interval stays at whatever it was when the data arrived, which is "never poll". That mistake is why
an auction used to sit on "Opening…" until someone reloaded.

**`lot_rescheduled` can move a clock EARLIER.** Unlike `lot_extended` (anti-snipe, later only), an
admin moving the auction's `ends_at` cascades in either direction. Apply the value absolutely; a
countdown that only ever grows is wrong here.

**The reserve amount must never appear in this app.** `reserve_met` is a boolean and is all a bidder
may see. `reserve_price_minor` is admin-only and must not be requested, stored or rendered.

**Never compute `minimum_next_bid_minor` yourself.** It is price-banded and configurable per auction
and per lot — server-owned. Read it from the lot, from the bid response, or from the 422 that tells
you someone bid first.

## The four gestures, and the win

Left is pass and right is bid — both recorded through `PUT /swipe`, both recoverable from My bids.
**Up is skip, and it is deliberately not remembered**: no request, nothing persisted, the card moves
to the back of the current stack and is back on the next load. It exists so someone can move past a
lot without acquiring another list to manage. Do not "improve" it by saving it.

**Down is undo, the inverse of up** — up sets a lot aside, down brings the last one back, which is
also the direction a list scrolls back. Both vertical gestures need a longer, faster pull than
left/right (150px or 700px/s, against 110/550) because they share an axis with page scrolling, and
the card sets `touch-none` so the browser cannot claim the gesture first.

**Undo covers all three gestures, newest first**, from one `history` list in `useLotStack` — mixing
a pass, a skip and a bid must rewind in the order they actually happened. Undoing a pass or an
interested swipe deletes the swipe server-side; **undoing a skip sends nothing**, because a skip was
never anything but local: dropping it from the history stops the lot being sorted to the back, and
it returns to the front on its own as the earliest lot still unresolved. With nothing to undo, the
card bounces rather than silently absorbing the pull — a gesture that does nothing invisibly is one
nobody discovers, and the hint says "Nothing to undo" instead of promising one. The Undo button
stays: the gesture is an addition, never a replacement.

**The drag hint is the only thing telling someone what a release will do, so it is built like it.**
One label, centred on the card and leaning up to 44px toward the direction of travel — not pinned to
the corner the card is heading for, which is exactly where it leaves the screen. It lives inside the
card and cancels the card's own transform (a point at the centre of a rotating box doesn't move, so
undoing `x` and `y` pins it, and a counter-rotation keeps the words level — measured at 0.00° while
the card sits at ±9°).

**Two states, one language for all four gestures**: *pending* is an outline in the gesture's colour,
*armed* is that colour filled with a thicker border and a small pop, and armed means "release now and
this commits" — `COMMIT_DISTANCE` sideways, `SKIP_DISTANCE` vertically. Colour alone is never the
signal; the border weight and fill carry it too. Pass is danger, bid is accent, skip is muted, undo
is `--undo`. The label always sits on an **opaque** background because it is read over user
photography of unknown brightness.

**The hint must agree with what the release actually does.** The commit check follows
`dragDirectionLock`'s axis and the hint reads the same rule. The flick shortcut also requires the
velocity to agree in sign with the offset: taking speed alone let a fast yank back to centre commit
the *opposite* gesture, so a card that read "BID" could pass the lot.

**Reduced motion drops the animation, not the information.** `prefers-reduced-motion` used to hide
these labels entirely, which removed the only signal of what a gesture would do from the people most
likely to need it. Both states still show; only the fade-in and the scale pop are dropped.

Every gesture has three ways in: the drag, a button, and an arrow key (←, →, ↑, ↓).

**Winning is announced once, properly.** A win is a `/me/bids` row that has ended with the user
still leading. Which wins have been celebrated lives in `localStorage` (`cw.wins_seen`) — it is
presentation state, and the cost of being wrong is one repeated announcement, not a lost record.
The modal is app-wide so it lands wherever the user is, fires live off the closing time (socket
events only reach lots the current screen subscribes to), and always answers "what now": the lots
won with prices, the balance, the payment reference and how to collect.

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
| `--undo` | the undo gesture's own hue | `#7DD3FC` | `#0A6A9E` |
| `--on-fill` | ink on a filled swipe hint | `#0A0A0B` | `#FFFFFF` |

`--undo` is a hue of its own rather than a reuse of `--success`: green already means *winning* here,
and a swipe hint is not a result. `--on-fill` exists because the relationship inverts between
themes — every hint fill is a light colour on dark and a dark one on light — so one token per theme
covers all four gestures. The lime is the exception and keeps `--accent-ink`, because it stays lime
in both.

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
| pending hint text on its surface (pass / bid / skip / undo) | 6.0 / 16.5 / 6.6 / 11.0 | 6.6 / 5.9 / 6.4 / 5.9 |
| armed hint ink on its fill (pass / bid / skip / undo) | 6.5 / 17.8 / 7.1 / 11.9 | 6.6 / 17.8 / 6.4 / 5.9 |
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

## Bidder accounts

Every bidder has **one running balance**, not a wallet per auction. Positive means credit, negative
means they owe. A deposit or a payment adds credit; winning a lot subtracts. R10 000 deposited then
R12 000 won leaves them at **−R2 000** — they owe R2 000, or they can pay the R12 000 and keep the
R10 000 on account for the next auction. Standing credit makes someone eligible for the next
auction automatically, with no action by anyone.

Each auction carries `deposit_amount_minor` — what must be on account before bidding *in that
auction*. `GET /me/account` returns the caller's own statement, paginated, and there is no route to
anyone else's.

**Browsing is deliberately ungated.** The auction list, the card stack, swiping in *both*
directions, lot detail and bid history all work with no deposit and no credit. The gate is only on
placing a bid. Do not add a gate, a blur or a nag anywhere else: someone has to be able to explore a
whole auction and then decide it is worth putting money down. The deposit requirement is shown on
the auction card as information, never as a barrier.

**A published auction is viewable before it opens.** Scheduled auctions are enterable: someone can
walk the lots and swipe, and swiping right still saves interest — it just cannot open the bid sheet,
because bidding is not open. Say when it opens rather than showing a dead button. Only `draft` is
hidden, and that is the backend's doing.

**Eligibility is the server's decision.** Show the requirement, but never compute eligibility
client-side as the source of truth — always handle the 403. It arrives typed
(`InsufficientCreditError`) with `required_minor`, `balance_minor`, `shortfall_minor` and
`currency_code`.

**Render `shortfall_minor`; never compute `required − balance`.** It is not clamped to the deposit:
someone who owes R250 against a R10 000 deposit needs R10 250, and the server says so. Computing it
locally quietly under-quotes anyone in debt.

**A negative balance is an invoice, not an error state.** These are customers who have just won
something. `lib/format/account.ts` turns the signed number into plain language ("R2 000 due" /
"R2 000 on account") because "−200000" is not usable. It also maps `entry_type` to human labels —
`lot_won` is "Lot won", `buyers_premium` is "Buyer's premium", `reversal` is "Correction".

**A `reversal` is shown as its own line and never netted against the entry it corrects.** The
statement is a history; an entry that silently vanishes is worse than one that is explained. The
same goes for `balance_after_minor` — the server accumulates it oldest-first and continues it across
pages, so it is rendered exactly as given, never recomputed.

**The payment reference travels with every request for money.** `GET /auth/me` carries
`payment_reference`; `components/account/PaymentDetails.tsx` is the single block that pairs it with
the instructions, used on the statement, the bid refusal and the win modal. A payment without a
reference is one the operator has to chase.

**How to pay comes from config** (`lib/config/payments.ts`, `NEXT_PUBLIC_PAYMENT_INSTRUCTIONS`).
Payment is arranged manually with the operator today; there is no payment flow in the product. The
fallback is an honest "contact the warehouse" line rather than invented bank details.

## Email verification and marketing consent

Both live on `/profile` and both read from the session user, which is replaced by whatever the
mutation returned — that is what makes the states flip without a refetch.

**An address has three states, not two, and the third is the one that hurts.** Unverified is
ordinary. Verified is quiet. **Bounced** (`email_bounced_at` set) means the address passed
verification and is now undeliverable — the user sees a tick and receives nothing, with no way to
work out why. So `EmailVerification` checks `email_bounced_at` *before* `email_verified_at` and says
plainly that mail is failing. It offers no "resend": the server refuses a code for an already
verified address, and only correcting the address fixes anything.

**Say the consequence, not the policy.** An unverified address is never routed to, so the copy is
"everything goes to you by SMS until you confirm this" — not a compliance notice. Nobody verifies an
address to satisfy a rule; they do it to stop missing things.

**Changing an email clears its verification server-side**, so `save()` must feed the PATCH response
into the session user. Keeping the old user object would leave a stale "verified" tick on an address
that is nothing of the sort.

**Verification is not a login.** It requires an existing session, issues no token, and changes
nothing about the session. Phone remains the only authentication identity — do not let this flow
grow a "sign in with email" affordance.

**The email code limiter is not the login OTP limiter** — 5/hour per address and 10/hour per user,
counted separately, and its `Retry-After` is measured in thousands of seconds. Handle the 429 from
the header and render the wait in minutes; "3591s" is not a wait anyone can picture.

**Preferences are marketing only, and the UI has to say so.** Someone who believes they have muted
everything and then misses an outbid alert is a support call nobody can answer well. The card states
outright that outbid, won and payment messages are always sent — that sentence is load-bearing, not
decoration.

**Never-asked is not opted-out.** An empty `notification_preferences` array means nobody has asked,
and it renders as "Not set", never as a refusal.

**Send only the channels the user actually moved.** `PUT /auth/me/notification-preferences` leaves
omitted channels untouched, so restating all three would stamp a fresh consent timestamp on choices
they never made — and consent is an auditable act.

**`OTP_CODE_LENGTH` (`lib/auth/otpCode.ts`) is shared by the login and email code inputs.** The
backend issues six digits for both; the value is overridable only because a local backend with
`OTP_DEV_CODE` set returns a shorter fixed code, and a six-box input cannot be completed with four
digits. Production runs on the default.

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

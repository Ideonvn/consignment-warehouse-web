@AGENTS.md

# Consignment Warehouse — web

The bidder-facing half of an auction platform replacing a business that ran inside WhatsApp groups:
the owner posted a photo, people bid in the thread, an admin closed it by hand. **The admin portal
is a separate repository and is not built here.** This app is the bidder's experience only.

The product is a **list of lots**, one row each: the amount it takes to lead, on a button that
places that bid when you press it, and beside it the sheet where you set the most you will pay. A
second screen shows what you're bidding on and whether you're winning. Auction list, lot detail and
profile are deliberately secondary.

**This was a stack of swipeable cards, and that is the single biggest thing to know about this
repository's history.** Swipe left to pass, swipe right to bid, up to skip, down to undo; three
layouts to choose between; a five-second window in which a swiped bid could be cancelled. The first
live stakeholder session found all of it too complex. The direction is now **fewest buttons, fewest
options, fewest taps to place a bid**, and the sections below say what each reversed rule used to be
and why it no longer holds, rather than quietly reading as though it never existed.

Everything below is real money in someone's hands. A user who is startled by what their tap
committed them to does not come back — and since the cancel window is gone, the tap *is* the
commitment, which raises the stakes on saying clearly what a button will do.

## Urgency is a mode, not a layout

A second stakeholder session asked for two things that read as opposites: **clearer, less technical
wording**, and **much more urgency as a lot approaches its close** — the second being roughly the
inverse of round 1's "fewest buttons, cleanest screen". They are both satisfied, and this is the
sentence that explains how:

> **Urgency is a function of the clock, not a permanent feature of the layout.**

At six days out a row is exactly as quiet as round 1 asked for. Inside the final hour it escalates.
Same component, same elements, driven by `effective_ends_at`, which the client already holds and
already ticks against `useNow()`. **Nothing here needed new data, and nothing was added to the
layout to make it louder.** Round 2 did not overrule round 1; it is layered on the clock.

**Permanent** (round 1's, and unchanged): two buttons a row and no pass; a bid placed the moment the
button is pressed, with no confirmation; one layout; nothing removed from the list by something the
user did; no watchlist, no presence count, no condition label, no glow on the bid button.

**Conditional on the clock:** the countdown's format and emphasis, the sticky close bar on the
auction header, and the alarm's fill. All five clock tiers, and the bar, are off until the time
remaining brings them on.

**Wording carries the rest**, and cost nothing: constant button labels, state moved out of labels
and into data lines, an icon beside every colour, uppercase on the two buttons that commit money.

## Stack, and why each piece is here

Locked decisions. Don't swap them out without a reason that survives the one below.

- **Next.js App Router, client-heavy SPA.** The server does routing, layouts and metadata; anything
  touching data is a client component. The access token is memory-only and the live layer is a
  WebSocket, so server-rendering authenticated data buys nothing and costs a lot of plumbing.
- **React Query** — the single place any screen reads server state. REST responses, bid responses
  and socket events all write into the same cache, so no component needs its own socket wiring.
- **zustand** — the two things that aren't server state: the auth session and the realtime
  connection status / per-lot sequence cursors. No provider ceremony.
- **framer-motion** — **its original justification is gone.** It was here because "the gesture layer
  is the product and hand-rolled drag physics is how it dies"; there are no gestures any more. It
  survives on a much smaller brief: the sheet's slide-up, the toast, the connection banner and the
  win modal (`Sheet`, `Toast`, `ConnectionBanner`, `WinCelebration` — four files, and the only four).
  That is a weaker reason than the one it was admitted on, so treat it as a **candidate for removal**
  rather than as a settled part of the stack: those four transitions are within reach of CSS.
- **zod** — validates every response at the boundary. `types/api.ts` is `z.infer` over those
  schemas, so a backend change surfaces as one clear parse error instead of `undefined` three
  components deep. Change the schema, not the type.
- **Tailwind v4** with the palette in `app/globals.css`. Dark, high-contrast, photo-first; one
  accent used sparingly. Light/Dark/System is layered on top of it — see Theming, and read that
  before touching a colour.
- **next-themes** — pre-paint theme application; see Theming for why it earns its place.

## Rules that are load-bearing

Each of these has a consequence attached. They are not style preferences.

**A bid is placed the moment the button is pressed.** No sheet in front of it, no confirmation
after it, no delay. `POST /bids` goes out on the press.

**This reverses a documented safety property, deliberately.** There used to be a five-second cancel
window between the gesture and the request — nothing was sent during it, so a mis-swipe cost
nothing because the request was never made. It existed because **there is no bid retraction API**,
and the only way to unmake a placed bid is an operator voiding it, which posts ledger reversals.
That fact has not changed. What changed is the judgement: stakeholders found the delay confusing —
a bid that has visibly not happened yet, with a countdown on it — and wanted the press to be the
bid. So the protection was **removed, not moved**, and the honest description of the trade is: a
mis-tap is now irreversible where it previously was not, and that was accepted in exchange for
immediacy. Two things still stand between a tap and a wrong bid, and both must survive: the button
carries the actual amount so the commitment is legible before the press, and it is a single-purpose
button in a row, not a whole-viewport gesture.

**A refused bid releases its own-bid claim.** `useBidSubmit` claims the lot before the request so
the socket echo of the caller's own bid is not misattributed — the echo usually beats the response
back — and `applyBidResult` clears the claim by naming the exact sequences that were ours. A refusal
produces no result, so it used to clear nothing and the claim stood for the full
`OWN_BID_WINDOW_MS`, silently swallowing a rival's genuine bid on that lot. **The claim is a
prediction that a bid is about to appear on that channel, and a refusal is evidence the prediction
is false**; holding a known-false prediction is strictly worse than dropping it. Only a 4xx is that
evidence: a 5xx, a dropped connection or an unparseable body all leave open that the bid committed
and its echo is still coming, so those keep the claim.

**The one guard that remains is idempotence.** `useLotActions` keeps a per-lot in-flight set and
refuses a second press while the first is outstanding, and every bid carries a fresh
`client_request_id`. Without that, a double tap on a slow connection is two bids.

**The list's right button bids exactly `minimum_next_bid_minor` with no maximum.** It sends no
`max_amount_minor` at all — the backend treats an absent maximum as "the bid is the maximum", so
omission is how "no proxy" is expressed. Raising is offered on the outcome, at the moment being
outbid makes its value obvious.

**The sheet asks for one number: the most you'll pay.** It sends `amount_minor` =
the server's `minimum_next_bid_minor`, and the user's typed number as `max_amount_minor`. Sending
their number as `amount_minor` would make their ceiling the visible price and overpay instantly.
The backend runs proxy bidding from that ceiling; the sheet says so out loud ("You'll pay only what
it takes to win, up to X"), because a UI that hides it produces users who feel tricked when the
price climbs on its own. Raising an existing maximum goes to `PUT /auto-bid` instead — maximums are
raise-only, validated inline before the server has to refuse. **The sheet has one editable field
and nothing else**: the +1/+2/+5 increment chips under the input were removed as noise.

**`am_i_leading: false` on a *successful* bid is normal, not an error.** A rival's hidden maximum was
higher and the backend counter-bid for them instantly. Say so plainly and offer to raise. Rendering
it as a failure teaches people the app is broken when it is working correctly.

**Every refusal now has nowhere to hide.** With no confirmation step, `BidOutcomeSheet` is the only
thing that can explain one, and all four paths are real and handled: the 403 with `shortfall_minor`
rendered exactly as the server gives it, the 409 for a lot that has stopped accepting bids, the 422
carrying the new minimum, and the 429 with the wait derived from `Retry-After`.

**Money is an integer number of minor units everywhere.** Never float arithmetic. The divide by 100
happens once, at render, in `components/ui/Money.tsx` — the only place money becomes text. Text that
is not rendered as an element (an `aria-label`, say) goes through `formatMoney`, which is what
`Money` itself calls; it never does its own arithmetic.

**One retry rule, in `app/providers.tsx`, and nowhere else.** A 4xx is the server having considered
the request and declined it: retrying asks the same question and expects a different answer. That
one sentence covers the 404 on a private auction, the 403 for a deposit not yet paid, the 409 on a
lot that has closed, and the 422 and 429 on search. `SessionExpiredError` is checked first because
it does not necessarily carry a status of its own.

**Put a status in that rule; do not put a predicate in a hook.** React Query's query-level `retry`
*overrides* the default wholesale rather than composing with it, so a local predicate is a second
copy of this reasoning — and this rule was independently rediscovered twice, in
`usePublicAuction` (404) and `useLotSearch` (all 4xx), before it was moved to the default and both
were deleted. `retryUnlessGone` is gone.

Two things the comment there says out loud rather than leaving implicit. **A 429 cannot be helped by
retrying here, measured rather than assumed:** every limiter in this API goes through one helper
that sets the key's TTL only on the first write — a fixed window — so the window is 60s while the
backoff is ~1s then ~2s, and both retries are refused by construction. Checked against the running
API: `Retry-After` read 60s, and still 60s after two retry-shaped requests, so a retry here is
futile rather than *actively* harmful. It would be actively harmful against a sliding window, which
is the reason not to relax the rule for 429 later. **And 408 is the one 4xx that plausibly
self-heals**, ruled out rather than overlooked: this API never emits one — FastAPI has no path that
returns it and Caddy answers a timed-out upstream with 504, a 5xx, which this rule retries. A
blanket "no 4xx" is right *for this API*, not everywhere.

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

**Urgency is a function of the clock, not a permanent feature of the layout.** This is the whole
reconciliation between round 1 (fewest buttons, cleanest screen) and round 2 (much more urgency).
Nothing was added to the row to make it louder: at six days out it is exactly the quiet row round 1
asked for, and the *same* elements escalate as `effective_ends_at` approaches. Anything permanent
would have overruled round 1; anything conditional on the clock satisfies both. Nothing new is
fetched to do it.

**The clock has five tiers** (`ClockTier` in `lib/format/time.ts`), and only the last two are loud:

| Remaining | Renders | Emphasis |
|---|---|---|
| > 48h | `Closes in 6d 0h` | muted, weight 400 — as it always was |
| 24–48h | `Closes tomorrow at 18:00` | muted, weight 400 |
| 1–24h | `4h 32m left` + a clock mark | `--text`, weight 500 |
| 60s–1h | `09:42 left` | filled `--danger` pill, `--on-fill` ink, type step up, bold |
| < 60s | `00:42 left` | the same pill, now breathing |

The thresholds are chosen for what a bidder can *act* on. Past 48 hours a duration is all anyone
needs. Inside two days a wall-clock time is something to plan around — and "tomorrow" is a calendar
fact, not a 24-hour window, so at 23:00 a close 47 hours out correctly reads `Closes Friday at
22:00` rather than lying about tomorrow. Inside a day the clock is today's business. Inside an hour
a bidder either watches or loses the lot, and that is where the alarm now begins.

**The final-hour treatment is the final-minute treatment, extended downward rather than reinvented.**
Same `--danger` fill, same `--on-fill` ink, same type step, same weight. **Four signals, only one of
which is colour** — a bidder who cannot distinguish red must still see it. The final *minute* adds a
fifth, the breath, and nothing else: the pill is already at full strength an hour out.

Under `prefers-reduced-motion` the breath stops and *everything else stays*: the `urgent` keyframe
puts the full-strength state at both 0% and 100% precisely so the global reduce rule, which snaps
every animation to its final frame, lands on the emphatic state rather than the dim middle of the
cycle. Measured against the running backend at 360×480, computed styles on the row's clock:

| State | opacity | transform | fill | ink | size | weight |
|---|---|---|---|---|---|---|
| < 60s, motion (dark) | 0.743 mid-cycle | `scale(0.972)` | `#FF5A5A` | `#0A0A0B` | 14px | 700 |
| < 60s, reduced (dark) | **1** | none | `#FF5A5A` | `#0A0A0B` | 14px | 700 |
| < 60s, motion (light) | breathing | breathing | `#B42318` | `#FFFFFF` | 14px | 700 |
| 60s–1h, either (dark) | 1 | none | `#FF5A5A` | `#0A0A0B` | 14px | 700 |
| 1–24h (dark) | 1 | none | none | `--text` `#F5F5F6` | 12px | 500 |
| > 48h (dark) | 1 | none | none | `--text-muted` `#9A9AA2` | 12px | 400 |

Dropping the animation drops no information: the reduced-motion row differs from the motion row in
opacity and transform only.

**The clock line reserves the alarm's height whether or not the clock is urgent** (`min-h-6` on the
row's clock line), and the bid-state line below it has its own `min-h-4`. Crossing *any* threshold
must not reflow the row and push the buttons down. Measured at 360×480 by driving each real
crossing on the live ticker — no reload, no refetch — with the row height read either side:

| Crossing | before | after |
|---|---|---|
| 48h (`Closes in 2d 0h` → `Closes Friday at 19:52`) | 181px | 181px |
| 24h (`Closes tomorrow at 19:52` → `23h 59m left`) | 181px | 181px |
| 1h (`1h 00m left` → `59:56 left`) | 181px | 181px |
| 60s (`01:02 left` → `00:56 left`) | 181px | 181px |

Minutes are zero-padded across the whole sub-hour range (`09:42`, `00:42`) so the pill's width never
changes as it counts down. That is a deliberate departure from the old `9:42`/`0:42`: a fixed width
is what makes the last hour reflow-free.

**`plain` turns the escalation off entirely, and auction-level clocks use it.** An auction's own
close, an "opens in", and the anti-snipe extension notice are not a lot's bidding deadline; an alarm
on them is crying wolf — and so is a wall-clock format that implies one. A `plain` clock renders
exactly what it always did: the bare duration, with the caller's own `prefix`. On lot detail the
alarm *replaces* the "live" `StatusPill` rather than nesting inside it, because an accent-bordered
container around a danger fill reads as neither — and that swap now happens at the final hour rather
than the final minute.

**The one deliberate exception is the auction's sticky close bar** (`AuctionCloseBar`), which is not
`plain`. It is derived from a *lot's* `effective_ends_at`, so it is a bidding deadline; see "The
sticky close bar" below.

**`status` is not authoritative for "can I bid".** It labels an *outcome*, so a lot reads `live`
until the lifecycle worker decides how it ended, while any bid past `effective_ends_at` is already
refused with a 409. Gate on the clock via `isLotOpen` (`lib/format/time.ts`). Trusting `status`
puts a live "Place a bid" button on a dead lot. The 409 branch is still reachable even with that
guard — a lot withdrawn or cancelled out from under a page that still shows it live — which is why
the copy says what is certain (no bid, no charge) rather than blaming the clock.

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
collapsed — a viewport the user may never actually have. `min-h-dvh` on `<body>` is the baseline and
nothing above it re-introduces `h-full`. The card stack used to make this acute by setting
`touch-none`, which stopped the bar ever collapsing; the stack is gone, but the rule is not, because
any new full-height screen inherits the same trap.

`--nav-h` in `app/globals.css` is the bottom nav's height, reserved by `AppShell` as page padding.
Change the nav's real height without this token and content lands under it. (`--stack-actions-h`
lived beside it and is gone with the stack.)

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
you someone bid first. It is now also *rendered*, on the Bid button, which makes this sharper rather
than softer: the number on the button is the number that gets sent.

## The win

**There are no gestures.** Left/right/up/down, undo, skip, the drag hints, the two-state armed
language, the arrow-key equivalents and the whole card surface they lived on are gone — see "One
layout" below for what replaced them and why. Nothing in this app responds to a drag.

**Winning is announced once, properly.** A win is a `/me/bids` row that has ended with the user
still leading. Which wins have been celebrated lives in `localStorage` (`cw.wins_seen`) — it is
presentation state, and the cost of being wrong is one repeated announcement, not a lost record.
The modal is app-wide so it lands wherever the user is, fires live off the closing time (socket
events only reach lots the current screen subscribes to), and always answers "what now": the lots
won with prices, the balance, the payment reference and how to collect.

## One layout: the list

There were three ways to browse an auction — a card stack, a photo gallery and a list — chosen per
device and remembered in `localStorage`, with the stack as the default and the stated identity of
the product. **All of that is gone.** The first live stakeholder session found the app too complex;
the direction is now fewest buttons, fewest options, fewest taps to place a bid. The list is the
only layout, there is no preference to set, and `/profile` no longer has a browsing section.

**Nothing is ever removed from the list because of something the user did.** Lots used to disappear
as they were passed or saved, and the visible set was the server's unswiped list minus this
session's decisions layered on top. Swiping is gone from the product and from the backend
(`lot_swipes`, `PUT/DELETE /swipe`, `GET /me/swipes` and `my_swipe` no longer exist), so a lot
leaves this list for exactly one reason: it ended and the server stopped returning it.

**Two buttons a row, and no pass.**

| Position | Label | Behaviour |
|---|---|---|
| Left | **AUTO BID** / *Set your maximum* | opens the slide-up sheet with an editable amount |
| Right | **BID R1 200** | places that bid immediately — no sheet, no confirmation |

The right button carries the real figure, `minimum_next_bid_minor`, rendered through `Money`.

**The left button's label is constant — on every row, in every state.** It used to read **"Enter
Maximum"** or **"Raise Maximum"**, switching on `my_auto_bid_max_minor`. Stakeholders found that
technical and ambiguous: neither wording says what pressing the button *does*. Worse, because a
plain bid sets a maximum equal to itself server-side, a row flipped to "Raise Maximum" the instant
someone bid — the label was reporting server state, which is not a label's job.

So the state moved to a data line under the bid status, where it belongs:

    Your auto bid: R2 500

State as data, not state as a verb. `my_auto_bid_max_minor` is still needed and still earns its
place on `LotCardOut` — it just drives a line rather than a label. **The line is absent when there
is no maximum**, not "no auto bid set", which would be noise on the majority of rows.

Both buttons are disabled together, on the clock (`isLotOpen`) and on the auction being live —
never one without the other, because a bid sheet that can be opened on a dead lot only leads to a
409 at the end of it.

**The lot number is a gold pill, top-right, and it says `LOT 1` — not `1`.** Testers could not find
it when it was a muted line under the title, and it is what people quote out loud and in a WhatsApp
message — "I'm asking about lot 1" — so it is the second thing you see after the photograph. **The
word is the entire point of the label**: a bare number in a gold pill is decoration, `LOT 1` is
something a person reads back down a phone line. It shipped briefly without the word, with the word
only in an `sr-only` span; that was the label losing its reason to exist. (The `sr-only` span went
with the change — with the word visible it would have a screen reader say "Lot LOT 1".)

`--accent` fill with `--accent-ink` (11.74:1, identical in both themes) and `--accent-edge`, which
is what keeps it reading as a mark rather than a smudge on a white card. It sits on the title's own
line, in the space the title was already leaving, so the row does not grow: the title truncates
instead. **Measured for the widest realistic case** — `LOT 148` on the seed's longest title (249
characters) at 360×480: pill 72.7px (against 54.2px for `LOT 1`), title truncated from 148px to
129px, **row height 181px, unchanged**. The pill costs no height at three digits. The same word is
on the sticky close bar's pill, for the same reason.

**The list pages on scroll**, via a sentinel (`useLoadMoreOnScroll`) — the whole set is on screen at
once, so paging cannot wait for the user to work down to the last few. No virtualisation: measured
at 250 lots — 2,839 DOM nodes, median frame 13.3ms, one frame over 50ms — so a windowing dependency
would be paid for by every auction to fix a problem no auction has.

**"Are you winning" is a join, not a field.** `LotCardOut` carries no `am_i_leading`, so the list
joins `/me/bids` (`active_only=false`, three states: absent, leading, outbid). That endpoint caps at
200 with no offset, so when the response is saturated an unmatched lot renders as **unknown**, never
as "you never bid" — silently telling someone they have no bid on a lot they are losing is worse
than admitting the app cannot tell.

**All four bid states carry an icon and a word.** Colour is never the only signal — the same rule
the countdown follows, for the same reason:

| State | Renders | Tone |
|---|---|---|
| `leading` | ✓ mark + **WINNING** | `--success` |
| `outbid` | ! mark + **OUTBID** | `--danger` |
| `none` | dashed mark + **NOT BIDDING** | muted |
| `unknown` | dashed mark + **BID STATUS UNKNOWN** | muted |

`unknown` is **not** a tidier `none` and must not be collapsed into one. It exists because the app
genuinely cannot tell past the 200-row cap, and the list keeps its one-line notice saying so. The
line is `min-h-4` so a state changing under a bidder never moves the buttons.

**A closed row shows the lot's outcome instead, and no bid state at all.** On a lot that has closed,
what the caller was doing is not the interesting fact — what happened to the lot is. The row used to
carry two lines saying nearly the same nothing, `Bidding closed` over `NOT BIDDING`; now the clock
slot carries `lotOutcome`'s pill (`Sold` / `You won` / `Unsold` / `No bids` / `Reserve not met` /
`Withdrawn` / `Cancelled`) and the bid-state line stands down. `amILeading` comes from a `/me/bids`
row we actually hold, so `You won` is positive evidence and nothing is ever *inferred* from a row we
may simply not have — the same rule search follows, and the reason both screens pass `bidStatus` and
`outcome` explicitly rather than letting the row guess.

That pill is 26px against the clock line's `min-h-6`, so a closed row measures **183px** where an
open one measures 181px. The 2px lands only on a row that has already closed, whose buttons are
already disabled; raising the reservation to absorb it would grow every open row instead.

**A bid event and a lot extension are announced inside the card, never between cards.** Both come
off the existing socket fan-out — no polling, no new endpoint — and land in `useRealtimeStore` as a
per-lot `LotNotice` that the row renders for six seconds. An alert about lot 2 floating in the gap
between lot 2 and lot 3 belongs to neither of them.

- **"Another bidder just bid R1 000"**, on a `bid` event, only on a row where the caller is
  `leading` or `outbid`. It is honest FOMO because it is a real event, and it says **nothing about
  who**: the payload carries `bidder_handle` and it is deliberately unused.
- **"Bid received — lot 2 extended by 5 min"**, on `lot_extended`. The figure is the *measured*
  jump — the close time held in cache is read before the patch overwrites it — not the auction's
  configured extension, because a bid at 3:26 remaining moves the clock by less than the full
  window. If no cached close time was available to measure against, the sentence stops at
  "extended" rather than inventing a figure.
- **"Closing time changed — lot 2 now closes 8 min earlier"**, on `lot_rescheduled`, which is a
  different event and gets different words. `lot_extended` is anti-snipe and only ever moves later;
  a reschedule is an admin moving the auction's `ends_at` and cascades in **either** direction.
  Calling a reschedule an extension is a lie to the user.

**A bidder's own bid is never announced back to them as somebody else's.** The socket echo of a bid
routinely arrives *before* its own HTTP response — verified against the running backend, where the
first build announced the user's own press to them — so the lot is claimed in `expectOwnBid` at send
time and the exact `is_mine` sequences from the response take over when it lands. The cost is that a
rival's proxy counter-bid inside those few seconds goes unannounced, which is much the better error:
that bidder is about to be shown the outbid outcome anyway.

**A bid event refreshes `/me/bids` whenever we hold a row for that lot.** Whether a bid displaced
the user is the server's to say — a rival's maximum is invisible here. Without this the list rendered
a stale **WINNING** directly beside an alert saying someone else had just bid, which is a lie about
someone's own money. `patchMyBid` reports whether the row was ours, so nothing is re-asked for lots
the bidder has no stake in.

**The sticky close bar says "next lot closes", never "auction closes".** That is about the data
model, not about wording. Anti-snipe is per lot: extending the auction's own `ends_at` would let one
contested lot hold the whole sale open, so each lot's `effective_ends_at` moves independently. Every
lot shares a base close until the first extension fires, after which an auction-level countdown is
simply wrong. `AuctionCloseBar` derives it from the **minimum `effective_ends_at` among the lots
still open**, names that lot, and pins itself below the auction title.

**It appears only inside the final hour.** Above that it is one quiet static line —
`29 lots · Closes Monday, 14 September at 19:37`, from `lot_count` and `ends_at`. `CLAUDE.md`'s own
reasoning for `plain` applies here: an alarm on a clock that runs for six days is crying wolf. Under
it sits one line of plain explanation built from the auction's **real** `anti_snipe_window_seconds`,
`anti_snipe_extension_seconds` and `max_extensions`, never hardcoded minutes.

It considers only the pages loaded so far. All lots share a base close until an extension moves one,
so page one holds the earliest in practice, and the set narrows as the list pages in.

**The bar is gated on `auction.status === "live"`, and must never contradict the auction badge.**
Without that gate it rendered on an auction badged `Ended` — reproduced on the seed as
`Ended` above `NEXT LOT CLOSES · LOT 11 · 02:23 left`, on a lot whose bid buttons were already
disabled. An auction that is over has no next lot to close.

**This is not the "gate on the clock, not `status`" rule being broken.** That rule is about *can I
bid*, where the clock is authoritative because `status` lags the lifecycle worker. Whether to raise
an urgency bar is a different question, and `ended` answers it outright. The lot-level filter still
uses `isLotOpen`; the auction-level one is the auction's own status.

The backend does not itself produce that state — `end_finished_auctions` marks an auction ended only
once its last lot has, and cancelling an auction cancels its still-open lots — so the data came from
a previous session's manual SQL. The client can still reach it on clean data through cache skew: the
auction and lots queries refresh independently, and only the first `SUBSCRIBE_AHEAD` lots receive
`lot_closed` over the socket, so a fresh `ended` auction beside a stale page of `live` lots is an
ordinary few seconds, not a corruption. The guard is correct either way.

**The count lives on that line and nowhere else.** The list used to print its own
`{lots.length} lots`; with the auction's own total above it, the two disagreed while paging.

**A ⓘ on the auction header opens the rules**, built entirely from the current `AuctionOut`: the
deposit (`deposit_amount_minor`, and an honest "no deposit is needed" at zero), the close in the
user's zone **with the zone named**, how anti-snipe really works, and the existing `PaymentDetails`
block. Three things stakeholders asked for are left out rather than invented — buyer's premium (the
column exists but `AuctionOut` does not expose it; see `NOTES.md`), VAT treatment and the collection
address. It is member-only: the public auction shape carries no anti-snipe fields and an anonymous
visitor has no payment reference.

**Cards are separated by space, a full border and a shadow — not by a gold edge.** `gap-3` between
rows, the existing full `--border`, the divider above the button row, and one new token,
`--card-shadow`. The mockups showed a gold left edge and it was **declined**: `--accent` is the bid
button's colour, and putting brand gold on every card edge dilutes the one thing on the screen that
means "press me". The neutral border separates just as well and leaves the accent to the lot pill
and the Bid button.

**My bids is one list.** It had three tabs — Bidding, Interested, Passed — and the last two listed
swipes. They went with swiping rather than leaving a single tab pretending to be a choice.

## Lot search

One input, results below, at `/search` — reached from a search icon on the **auctions** header, not
from a fourth nav tab. Search is global, so it belongs to the screen that owns the whole catalogue
rather than inside one auction; and a tab is an option on every screen forever, which is the move
round 1 asked us to stop making.

**It matches the lot title (substring) and the lot number (exact). It does not match the
description, and it does not match the auction's name.** The empty-result copy says so out loud,
because a search that silently ignores half of what someone typed teaches them it is broken.

**The minimum term length is mirrored in the client**, which normally the guardrails forbid. It is
allowed here because a minimum term length is an **input precondition, not a filter over data**: if
the server raises its minimum, the stale client value produces a 422 that is loud and immediate
rather than a quietly wrong result set. That is the acceptable drift direction, and the 422 is
handled anyway. **A purely numeric term is exempt at any length** — it is an equality on an indexed
lot number rather than a substring scan, and every auction has a lot 1, so blocking `7` would break
the most obvious search there is.

### `/me/bids` is not trustworthy here, and that is the whole reason this section exists

**`GET /me/bids` is windowed by the two-week rule. Search is deliberately not.** Search reaches
auctions that aged out of `GET /auctions`, because "what did that go for" is the question it
answers. So a search row can be a lot the bidder bid on and even won, absent from `/me/bids` *only
because that endpoint filtered it* — and with a small dataset the response is nowhere near the 200
cap, so `truncated` is false and `useMyBidStatus.statusFor` answers `none` with total confidence.
The row then reads **NOT BIDDING** on someone's own money. That is exactly the failure the `unknown`
state was invented to prevent, arriving through a door nobody built it for.

**The rule that resolves it: a `/me/bids` row we hold is positive evidence and is true in both
directions; only its *absence* is ambiguous, and only outside the window.**

So `SearchScreen` splits on the clock, not on `status`:

- **A biddable row** (`isLotOpen`) belongs to an auction that has not ended, so it is inside the
  window and `/me/bids` reliably has it. The join is sound and all four bid states render exactly as
  they do on the auction list.
- **A closed row** shows the **lot's outcome** instead — Sold, Unsold, Reserve not met — from
  `lotOutcome`, in the clock line's own reserved slot, with no bid-state line at all. That is what
  someone searching for a finished item actually wants, and it needs no join. Where we *do* hold the
  row it is used, but only in the direction it can be trusted: `amILeading` is passed when
  `statusFor` says `leading`, which turns the pill into "You won"; it is never inferred from a row
  we may simply not have.

The trap was reproduced before it was fixed — see NOTES.md. **The unreliable case is simply never
asked**, which is why this needed no extra mode on `useMyBidStatus` and no second `/me/bids` call.

**Do not solve this by reimplementing the window in the client.** The window is a server setting and
a second copy will drift. And never assert `none` for a bid state the client cannot determine: the
alternative here is silence plus a fact about the lot, which is always available and never a lie.

### The cursor, and the one thing about it that must not be "fixed"

**The cursor is opaque. It goes back exactly as `X-Next-Cursor` gave it — never parsed, decoded or
constructed.** It carries the compound sort key (a lot number is unique only inside an auction, and
this is cross-auction) *and* a pinned instant, and the server answers a malformed one with a 422.
Note that `listLots` does `Number(nextCursor)` for the auction lot list; `searchLots` must not, and
its page param is a string for that reason.

**The pinned instant means a long pagination walk can list a lot as biddable slightly after it
actually closed. Leave it.** Pinning is what makes the walk skip and repeat nothing; the row gates on
the clock through `isLotOpen`, so both its buttons disable on their own.

### Everything else it reuses

**`LotSearchResultOut` is a structural superset of `LotSummary`**, so `LotRow` renders it unchanged —
the gold lot pill, the five clock tiers, the two buttons, the bid state. **`LotSummary` was not
widened** to carry `auction_name` or `currency_code`: its whole job is naming what the member *and*
the anonymous card shapes both have, and search is member-only. The row takes those two as ordinary
optional props instead.

- **`auction_name` sits above the title** in the quietest type on the row. The auction is context;
  the lot is the subject. A lot number alone is ambiguous across auctions, which is why the backend
  puts the name on the shape at all.
- **`currency_code` is passed to `Money` per row.** ZAR is the only currency in practice; doing it
  anyway is what stops the day it isn't from being a bug hunt.
- **Paging is `useLoadMoreOnScroll` and the `X-Next-Cursor` / `X-Has-More` pair**, as the auction
  lot list does.
- **The query key is `["lots", "search", term]` — deliberately under the `lots` prefix**, so
  `patchLot` finds search pages while walking `["lots"]` and a bid response or a socket event
  updates a search row with no wiring of its own.
- **The term is in the key**, so React Query drops the results of a term the user has typed past.
  The input is debounced 300ms on top of that: a ten-character term costs three or four requests
  against a 60/min ceiling.
- **Only biddable results are subscribed, and only the first 12.** A closed lot's price cannot move.
  The socket caps a connection at 200 lots; 12 is what the auction screen holds, so paging deep
  through search never approaches it.

**The search query has no retry rule of its own, because the app-wide one now covers it.** It used
to carry a local predicate for 429/422; that reasoning lives in `providers.tsx` — see "One retry
rule" below — and a second copy of it here would be a thing to keep in step. `SearchCursorError`
survives, but as an `ApiError` carrying the 422 it wraps rather than a bare `Error`: the class is
what the screen branches on, the status is what the retry rule reads. Because it now carries a 422,
`termRefused` has to say "without a cursor" explicitly instead of inferring it from the status.

**The two 422s mean opposite things and are told apart by whether we sent a cursor** — the only
place that fact is still in scope. A short term is the user's input and gets the server's own words
inline on the field, with nothing below it; a rejected cursor is our bug and gets a reset of the
walk rather than any blame on the term. The 429's wait goes through `formatDuration`, because
"3591s" is not a wait anyone can picture. The 401 is the client's single-flight refresh and gets no
second path.

**`/search` is deliberately absent from `lib/auth/publicPaths.ts`.** There is no public or anonymous
search endpoint. The guard's failure direction is already the safe one — a new route ships guarded
unless someone allowlists it — so this needs no action, only the discipline never to "fix" a
redirect by widening the allowlist. An anonymous visitor on `/search` should meet the guard, not a
screen that 401s.

## Lot photography

**On lot detail nothing is cropped.** The gallery letterboxes: `object-contain` against black, so a
landscape photo from a phone shows its full width and a tall portrait shows its whole height, with
the bands falling wherever the aspect ratio puts them. It used to be `object-cover` in a 4:3 box,
which quietly ate the ends of every photo that was not 4:3 — on the one screen where somebody is
examining the thing they are about to spend money on.

**The list keeps its crop.** A ragged list is worse than a cropped thumbnail, and the row is a
pointer to the lot rather than a look at it. Only the detail page letterboxes.

**Tapping a photo opens it full screen, and pinch-zoom is the browser's, not ours.** The overlay is
a scroll-snap track with `touch-action: pan-x pinch-zoom`, which tells the browser it may claim the
two-finger gesture — so iOS Safari and Android Chrome do the zooming with their own momentum, bounds
and double-tap. **No library, no gesture code, no dependency.** The one thing this depends on is the
document permitting user scaling: `app/layout.tsx` sets `maximumScale: 5` and, critically, **never
`userScalable: false`** — setting that would silently kill pinch-zoom everywhere, and it is the
failure mode to look for first if zoom ever stops working. `pan-y` is deliberately absent from the
track so a vertical drag cannot scroll the page behind the overlay.

**A lot may carry up to 20 photos**, so the viewer pages and states the position as "3 / 20" rather
than a row of dots nobody can count. The position is also announced to a screen reader through a
live region, because a scroll-snap change is otherwise silent. Only the first image gets `priority`;
the rest lazy-load, which matters more now that 20 is possible and image optimization is off.

## Anonymous browsing

Public auctions are readable with no account at all, through `/public/*`. **The URLs are the same
ones members use** — one canonical link per auction and per lot — because a link pasted into a
WhatsApp thread has to open for whoever receives it. Two URLs for one lot would split sharing and
let someone send a link that does not work.

**The guard stays in the layout, with an allowlist.** `lib/auth/publicPaths.ts` names the three
public paths and `AuthGuard` consults it. The alternative — no guard in the layout, `<AuthGuard>`
added to each private page — inverts the failure direction: a new page would ship public unless
someone remembered, and the pages behind this guard show a ledger and a phone number. A mistake in
the allowlist leaves a public page guarded, which is loud and harmless.

**Anonymous visitors look and nothing else**, and the restraint that applies to signed-in browsing
applies here: no deposit, no blur, no nag, nothing hidden behind signing up. One "Get started" bar,
exactly `--nav-h` tall so it sits where the bottom nav does and the layout maths is unchanged.

**Absence, not disabled controls.** `LotList` takes `actions?`; anonymous passes nothing and the
rows render **no buttons at all**. A disabled control is an invitation to work out how to enable it.
(This is now the *only* difference between the member and anonymous list, which is why one component
serves both — there is no second layout to keep in step, as there was when the gallery existed.)

**`LotSummary` is the boundary, not a mode flag.** The public shapes carry no `am_i_leading` and no
`my_auto_bid_max_minor` — absent, not null — and the presentational components take the structural
type both sides satisfy. Widen `LotSummary` only with fields that exist on *both* sides; the list
reads `my_auto_bid_max_minor` through one narrow, commented cast at the single site that needs it,
rather than widening the type and losing the guarantee. Exactly three places ask which mode they are
in: the entries for `/`, the auction and the lot.

**The public client is its own module** (`lib/api/publicClient.ts`), not a flag on `client.ts`.
`generateMetadata` runs in Node, and the authenticated client touches the session store and the
clock offset — module-level state that a server process shares across every request it is handling.
It also sends `credentials: "include"` unconditionally and can reach `endSession()` on a 401. None
of that may be in the path of an anonymous read. **The single-flight refresh is untouched.**

**Live-ness is polling, because there is no anonymous socket.** `/public/auctions/{id}/prices` every
10s while live, 5s once any visible lot is inside its anti-snipe window (the only time this model
moves fast), 60s while scheduled, not at all once ended. Never below the endpoint's own `max-age=5`,
paused when the tab is hidden, and stopped after ten idle minutes with a tap to resume. The
countdown stays client-side on `useNow()`, so the clock ticks smoothly while prices step.

**A 404 on something already rendered is not the same as a 404 on arrival.** Visibility is
changeable at any time, so an auction can go private while somebody is reading it. The API cannot
tell those apart without confirming that private things exist; the client can, because it had the
thing a moment ago (`lib/public/seen.ts`). Previously seen gets "no longer available"; first load
gets an ordinary not-found. The **price poll is what usually notices** — the auction and lot queries
are sitting on cached data with no reason to re-ask.

**`cw.had_session` is a hint and never authority.** The refresh cookie is HttpOnly on the API's
origin, so neither the server nor the client knows whether a visitor is signed in until the refresh
returns — which means one wrong first paint is unavoidable. The hint picks which: a device that has
signed in before waits behind a skeleton, a device that has not gets the public content immediately.
It grants nothing, and it is cleared in `endSession` so a failed refresh drops it too.

## Theming

Light / Dark / System, selectable on `/profile`. **Dark is the default and the product's
identity**; light exists for daylight readability and is opt-in.

**The palette is declared twice on purpose.** Raw tokens (`--bg`, `--accent`, ...) live on `:root`,
and `@theme inline` maps them to Tailwind's names (`--color-bg` -> `var(--bg)`). Tailwind resolves
`@theme` statically, so a palette declared directly there cannot be overridden — with the
indirection, one `[data-theme="light"]` block re-points the raw tokens and every existing `bg-bg`,
`text-text` and `border-border` follows. Add new colours as a raw token plus an `@theme inline`
mapping, never as a literal.

**The accent is the logo's gold, `#F6C000`** — sampled from the artwork, where the dominant cluster
is `#F6BA00`/`#F6C000`/`#F6C600`. It replaced a lime `#E8FF5A`. The logo's black `#0A0A0A` and its
white already matched the existing `--bg` and text tokens, and its red (~`#AE0000`) is close enough
to `--danger` that nothing moved there.

**The accent is not a neutrals problem, and gold has the lime's problem in milder form.** The lime
was ~1.1:1 against white; gold is 1.69:1 — better, still far under the 3:1 a non-text boundary
needs. So the same three tokens exist, and which one you reach for depends on how the colour is used:

| Token | Use | Dark | Light |
|---|---|---|---|
| `--accent` | brand **fills** (buttons, selected tab, logo) | `#F6C000` | `#F6C000` — unchanged |
| `--accent-ink` | the label on a gold fill | `#0A0A0B` | `#0A0A0B` — unchanged |
| `--accent-text` | accent as **text**, and thin marks that must be seen (focus rings, live dot, toast bar) | `#F6C000` | `#806200` — darkened same hue |
| `--accent-edge` | border on a brand fill | `transparent` | `#806200` |
| `--on-fill` | ink on a filled **danger** mark — the final-hour countdown | `#0A0A0B` | `#FFFFFF` |

**The gold stays gold in both themes**, exactly as the lime did — it is the brand colour and must
not be darkened into something else in light mode. Only the *text* and *edge* variants diverge.
`--accent-edge` is why the gold button still reads as a button on white: the fill alone is 1.69:1
against a white card, so light gives it an edge rather than abandoning the brand colour. In dark it
is transparent and nothing shifts. `--accent-ink` needs no per-theme value because it sits on the
gold, which is the same in both — 11.74:1 either way.

**`#806200` is close to a ceiling, not a free choice.** It serves double duty as text and as the
edge, and the edge needs 3:1 against the gold fill — it lands at 3.40. Anything lighter buys brand
warmth by failing a non-text boundary.

**`--undo` was deleted.** It was a hue of its own for the undo gesture; there is no undo gesture.
**`--on-fill` was kept and repurposed**: it encodes something still true — that the ink on a filled
mark inverts between themes — and the final-hour countdown needs exactly that. It is a live token
with one consumer, not a leftover.

**`--card-shadow` is the one token this round added, and it is not a colour.** Lot cards are lifted
off the page with it: `0 1px 2px rgb(0 0 0 / 0.5)` on dark, `0 1px 3px rgb(16 16 26 / 0.1)` plus a
tighter second layer on light. It has no contrast ratio to clear. Being honest about what it does:
on **dark** it is barely perceptible and the border does nearly all of the separating — the card
surface sits at 1.08:1 against the page; on **light** (1.10:1, and a soft border) it is what makes a
white card read as a card. Space and the border carry dark; the shadow carries light. Everything
else this round reuses tokens that already existed, which is why the ratio table below needed no new
values — only new rows confirming the pairings.

**Green was left alone, and that was checked rather than assumed.** Every green in the app resolves
to `--success`: the winning/outbid badge, the lot-detail outcome panel, the win modal, the toast,
`StatusPill`, and `lotOutcome`'s success tone. The single arguable case is `AccountScreen`, which
uses `text-success` for a *credit* ledger line — money in rather than a lot won. It stays green:
"good thing happened to your balance" is the same family as winning, and a fourth semantic colour
to separate them would be worse than the overlap. Nothing green was repainted gold, because winning
and branding must not become the same colour.

**Measured ratios** (WCAG AA: 4.5:1 body text, 3:1 large text and non-text boundaries). Every row
below was recomputed for this change with a WCAG relative-luminance implementation, including the
rows the accent does not touch:

| Pairing | Dark | Light |
|---|---|---|
| text on bg / surface / raised | 18.16 / 16.89 / 15.26 | 16.43 / 18.04 / 15.45 |
| muted text on bg / surface / raised | 7.08 / 6.59 / 5.95 | 5.79 / 6.36 / 5.44 |
| accent-text on bg / surface / raised | 11.74 / 10.92 / 9.87 | 5.22 / 5.73 / 4.91 |
| accent-text on the `accent/10` tint (over surface) | 9.04 | 5.43 |
| accent-text on the `accent/10` tint (over raised) | 8.01 | **4.69** — tightest in the palette |
| accent-ink on the accent fill (button label) | 11.74 | 11.74 |
| accent-ink on the `accent/90` hover fill | 9.68 | 12.29 |
| danger on bg / surface / tint | 6.47 / 6.01 / 5.35 | 5.98 / 6.57 / 5.58 |
| success on bg / surface / tint | 11.36 / 10.56 / 8.82 | 6.01 / 6.60 / 5.69 |
| success on the `success/5` tint (win modal) | 9.73 | 6.15 |
| danger on the `danger/5` tint (statement) | 5.69 | 6.05 |
| on-fill ink on the danger fill (final-minute clock) | 6.47 | 6.57 |
| danger fill vs surface (that clock's own boundary) | 6.01 | 6.57 |
| accent fill vs surface (button edge) | 10.92 | 1.69 -> `--accent-edge` at 3.40 vs the fill, 5.73 vs white |
| input border (`--border-strong`) vs its fill | 1.16 (see below) | 3.12 |
| card border vs surface (decorative) | 1.29 | 1.39 |
| **lot-number pill:** accent-ink on the accent fill | 11.74 | 11.74 |
| **bid states:** success / danger / muted on surface | 10.56 / 6.01 / 6.59 | 6.60 / 6.57 / 6.36 |
| **hours tier:** text on surface | 16.89 | 18.04 |
| **bid alert:** danger on the `danger/10` tint over surface | 5.35 | 5.58 |
| **extension alert:** accent-text on the `accent/10` tint over surface | 9.04 | 5.43 |
| **reschedule alert:** text on surface-raised | 15.26 | 15.45 |
| **sticky close bar:** muted on bg | 7.08 | 5.79 |
| **AUTO BID sublabel:** muted on surface-raised | 5.95 | 5.44 |
| card surface vs page bg (what `--card-shadow` supplements) | 1.08 | 1.10 |

**A correction to the previous table.** Light `success` was recorded as 6.7 / 7.3 / 6.3. The shipped
token is `#146b33` and actually measures **6.01 / 6.60 / 5.69**; the recorded figures correspond to
roughly `#146333`, a one-digit transposition. Nothing shipped failing — every value clears 4.5 — but
the number in the file was wrong, which is a third instance of this file recording a ratio that had
not been measured against the value actually in the CSS. The harness used here was cross-checked
against every other row of the old table first, including the `#15803D`-on-its-own-tint 4.38 that
this file records as a caught failure, and reproduced all of them exactly.

**Known deviation:** the *decorative* card border is ~1.3:1 in both themes, and the dark input
border is 1.16:1 — both pre-date theming and are unchanged here. Light inputs use `--border-strong`
because they would otherwise be imperceptible; raising dark's `--border-strong` to ~`#6C6F78` would
close the dark gap, and is a one-line change if wanted.

**Card photos:** light surfaces are neutral white so lot photography still dominates — that is why
dark was chosen originally and the light theme must not tint it away.

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

**Browsing is deliberately ungated.** The auction list, the lot list, lot detail and bid history
all work with no deposit and no credit. The gate is only on placing a bid. Do not add a gate, a blur
or a nag anywhere else: someone has to be able to explore a whole auction and then decide it is
worth putting money down. The deposit requirement is shown on the auction card as information,
never as a barrier.

**A published auction is viewable before it opens.** Scheduled auctions are enterable: someone can
walk the lots and read them; both row buttons are simply disabled, because bidding is not open.
Say when it opens rather than showing a live-looking button. Only `draft` is hidden, and that is the
backend's doing.

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

- `app/` — routes. `(app)/` is everything with app chrome, which is not the same as everything
  private: `/`, `/auctions/[id]` and `/lots/[id]` are **canonical URLs that work signed in or not**.
  The wall is `AuthGuard`, still in that group's layout, minus the allowlist in
  `lib/auth/publicPaths.ts`. `login/` and `welcome/` sit outside the group entirely.
- `components/` — UI primitives (`ui/`) plus feature components grouped by surface.
- `lib/api/` — typed client, endpoints, zod schemas, error classes, query keys, cache writers.
- `lib/auth/` — session store, device id, login flow state.
- `lib/realtime/` — socket client, event→cache reducer, connection/sequence store. The store also
  holds the per-lot transient `LotNotice` that a row renders as an in-card alert, and the record of
  which bid sequences were the caller's own.
- `lib/format/` — money, time, lot status. Pure functions; they take `now` rather than reading it.
- `lib/hooks/` — shared hooks (paging, subscriptions, ticker, bid submission, list actions).
- `types/` — API types inferred from the zod schemas.

`lib/browse/` and `lib/bid/` are gone — they held the layout preference, the browse-session history
and the pending-bid store, none of which have a subject any more.

New this round: `components/search/SearchScreen.tsx` and `lib/hooks/useLotSearch.ts` — the
`/search` screen and its paging, member-only. `components/lot/LotList.tsx` now **exports `LotRow`**,
because search reuses the row rather than forking it.

The round before: `components/auction/AuctionCloseBar.tsx` (the sticky final-hour header) and
`components/auction/AuctionInfoSheet.tsx` (the ⓘ sheet), both member-side.

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
per lot, and **lot search at 60/min per user** with a real `Retry-After`.

## Guardrails

- **No new dependencies** without a reason that maps to the stack above. No component library —
  build the primitive. Pinch-zoom was done with `touch-action` and the browser, not a library.
- `next-themes` is the one dependency added outside the original stack: it exists for the
  pre-paint script, OS-change handling, cross-tab sync and SSR agreement, all of which are easy to
  hand-roll incorrectly. `framer-motion` is now the one whose justification has *shrunk* — see the
  stack section, and note that the in-card alerts deliberately did **not** become a fifth consumer:
  their entrance is a CSS keyframe (`notice-in`), whose final frame is the settled, fully legible
  state so the reduce-motion snap lands on the message. Same property as `urgent`.
- **Never put the access token in storage**, and never read the refresh token from JS.
- **Never compute `minimum_next_bid_minor`, or reveal a reserve amount.**
- **Never re-apply a filter the server already owns.** `GET /auctions` and `GET /me/bids` exclude
  anything whose auction ended more than two weeks ago. A second copy of that rule in the client is
  a second thing to keep in step, and it will drift. **`GET /lots/search` is exempt from that window
  on the server**, which is precisely why `/me/bids` cannot be joined against every search row —
  see "Lot search".
- **Never assert a bid state the client cannot determine.** `none` means "we know they have not
  bid", and it is only knowable where `/me/bids` is complete for that lot. Everywhere else the
  answer is `unknown`, or silence plus a fact about the lot — never "NOT BIDDING".
- **Never widen the allowlist to fix a redirect.** `/search` is signed-in only and is deliberately
  absent from `lib/auth/publicPaths.ts`; there is no anonymous search endpoint.
- **Never parse an opaque cursor.** `X-Next-Cursor` from search carries a compound sort key and a
  pinned instant; it goes back verbatim or it comes back a 422.
- **Don't create git commits.** Stage the work and let the developer review it.
- **Delete rather than deprecate.** Nothing is live.
- Verify against the running backend, don't reason about it. Every bug worth finding here was found
  by driving the real thing (see NOTES.md).

## Known gaps

Accepted, with reasons. Please don't re-raise them.

- **`/me/bids` caps at 200 with no offset**, so the list's "Winning / Outbid" badge cannot be
  resolved for a bidder with more than 200 bids. Those rows say so explicitly rather than guessing,
  and the list shows a one-line notice. Fixing it properly needs paging on that endpoint; asserting
  "no bid" would be a lie about someone's own money, which is why the unknown state exists.
- **The theme preference is `localStorage` only, never synced to the backend.** Theme is genuinely
  per-device — the same person wants dark on a phone at night and light on a laptop in daylight — so
  syncing it across devices would be wrong behaviour, not a missing feature. Do not "fix" this by
  adding a user field.
- **Lot metadata is real for public lots and generic for private ones.** `generateMetadata` fetches
  `/public/lots/{id}` server-side — no token is involved, which is exactly why the server can render
  it — so a shared link previews the photo, the title and the price. A private or missing lot 404s
  there and falls back to site metadata; **that is deliberate, not a shortfall**, because a title
  naming a private lot would confirm it exists.
- **Bid history refetches rather than splicing** a new bid into page one. Simpler and always
  correct; one small request per bid, on the lot detail screen only.
- **Image optimization is off** (`next.config.ts`) until the media host is settled — lot photos come
  from whatever host the backend serves, and a `remotePatterns` allowlist breaks silently on a new
  one. This costs more on lot detail now that images are letterboxed and openable full screen, and
  it is the reason a lot with 20 photos is heavier than it needs to be.
- **Eight exported symbols have no callers** — `BidStatus`, `PublicLotImage`, `UserRole`,
  `UserStatus`, `clockOffsetMs`, `isClockSynced`, `formatMoneyDelta`, `normalisePhone`. All eight
  predate the simplification (verified against `HEAD`), and the four in `types/api.ts` are arguably
  deliberate contract surface. Left alone rather than swept up inside an unrelated change.

**Removed from this list:** *"A plain bid sets a maximum equal to itself, so a row reads 'Raise
Maximum' immediately after a no-maximum bid."* The backend still behaves exactly that way — nothing
was fixed server-side. What changed is that the left button no longer reports server state, so there
is no longer a symptom to describe. The label was never the right place to encode a maximum; the
`Your auto bid: R2 500` line is, and it is *correct* to appear straight after a plain bid. The
condition is gone rather than papered over, which is why the entry is deleted rather than reworded.

`NOTES.md` holds the longer record: judgement calls, backend requests, and the end-to-end
verification runs including the bugs they caught.

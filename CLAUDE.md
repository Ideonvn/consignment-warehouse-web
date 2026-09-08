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

**The final minute is an alarm, not red text.** `Countdown` switches to a filled `--danger` pill
with `--on-fill` ink, a type step up and bold weight, plus a slow breath. **Four signals, only one
of which is colour** — a bidder who cannot distinguish red must still see it. Under
`prefers-reduced-motion` the breath stops and *everything else stays*: the `urgent` keyframe puts
the full-strength state at both 0% and 100% precisely so the global reduce rule, which snaps every
animation to its final frame, lands on the emphatic state rather than the dim middle of the cycle.
Measured: with motion, opacity 0.93 mid-cycle; with reduced motion, opacity exactly 1 and the fill,
weight and size unchanged.

**The clock line reserves the alarm's height whether or not the clock is urgent** (`min-h-6` on the
row's clock line). Crossing into the final minute must not reflow the row and push the buttons down
— measured across a real crossing at 360×480: row height 167px at 1:28 and 167px at 0:59.

**`plain` turns the alarm off, and auction-level clocks use it.** An auction's own close, an "opens
in", and the anti-snipe extension notice are not a lot's bidding deadline; an alarm on them is
crying wolf. On lot detail the alarm *replaces* the "live" `StatusPill` rather than nesting inside
it, because an accent-bordered container around a danger fill reads as neither.

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
| Left | **Enter Maximum** / **Raise Maximum** | opens the slide-up sheet with an editable amount |
| Right | **Bid R1 200** | places that bid immediately — no sheet, no confirmation |

The right button carries the real figure, `minimum_next_bid_minor`, rendered through `Money`. The
left button's label reads off `my_auto_bid_max_minor`, which the backend now puts on `LotCardOut`
for exactly this — one field instead of a per-row fetch. Note that a bid placed with no maximum
still *sets* a maximum server-side, equal to the bid, so a row flips to "Raise Maximum" straight
after a plain bid. That is faithful to the field and to what the user would want to do next.

Both buttons are disabled together, on the clock (`isLotOpen`) and on the auction being live —
never one without the other, because a bid sheet that can be opened on a dead lot only leads to a
409 at the end of it.

**The lot number is top-right and large.** Testers could not find it when it was a muted line under
the title, and it is how people refer to lots out loud and in a WhatsApp message — so it is the
second thing you see after the photograph. It sits on the title's own line, in the space the title
was already leaving, so the row does not grow: the title truncates instead.

**The list pages on scroll**, via a sentinel (`useLoadMoreOnScroll`) — the whole set is on screen at
once, so paging cannot wait for the user to work down to the last few. No virtualisation: measured
at 250 lots — 2,839 DOM nodes, median frame 13.3ms, one frame over 50ms — so a windowing dependency
would be paid for by every auction to fix a problem no auction has.

**"Are you winning" is a join, not a field.** `LotCardOut` carries no `am_i_leading`, so the list
joins `/me/bids` (`active_only=false`, three states: absent, leading, outbid). That endpoint caps at
200 with no offset, so when the response is saturated an unmatched lot renders as **unknown**, never
as "you never bid" — silently telling someone they have no bid on a lot they are losing is worse
than admitting the app cannot tell.

**My bids is one list.** It had three tabs — Bidding, Interested, Passed — and the last two listed
swipes. They went with swiping rather than leaving a single tab pretending to be a choice.

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
| `--on-fill` | ink on a filled **danger** mark — today the final-minute countdown | `#0A0A0B` | `#FFFFFF` |

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
mark inverts between themes — and the final-minute countdown needs exactly that. It is a live token
with one consumer, not a leftover.

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
- `lib/realtime/` — socket client, event→cache reducer, connection/sequence store.
- `lib/format/` — money, time, lot status. Pure functions; they take `now` rather than reading it.
- `lib/hooks/` — shared hooks (paging, subscriptions, ticker, bid submission, list actions).
- `types/` — API types inferred from the zod schemas.

`lib/browse/` and `lib/bid/` are gone — they held the layout preference, the browse-session history
and the pending-bid store, none of which have a subject any more.

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
  build the primitive. Pinch-zoom was done with `touch-action` and the browser, not a library.
- `next-themes` is the one dependency added outside the original stack: it exists for the
  pre-paint script, OS-change handling, cross-tab sync and SSR agreement, all of which are easy to
  hand-roll incorrectly. `framer-motion` is now the one whose justification has *shrunk* — see the
  stack section.
- **Never put the access token in storage**, and never read the refresh token from JS.
- **Never compute `minimum_next_bid_minor`, or reveal a reserve amount.**
- **Never re-apply a filter the server already owns.** `GET /auctions` and `GET /me/bids` exclude
  anything whose auction ended more than two weeks ago. A second copy of that rule in the client is
  a second thing to keep in step, and it will drift.
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
- **A plain bid sets a maximum equal to itself**, so a row reads "Raise Maximum" immediately after a
  no-maximum bid. That is the backend's model faithfully reflected, not a labelling bug.
- **Eight exported symbols have no callers** — `BidStatus`, `PublicLotImage`, `UserRole`,
  `UserStatus`, `clockOffsetMs`, `isClockSynced`, `formatMoneyDelta`, `normalisePhone`. All eight
  predate the simplification (verified against `HEAD`), and the four in `types/api.ts` are arguably
  deliberate contract surface. Left alone rather than swept up inside an unrelated change.

`NOTES.md` holds the longer record: judgement calls, backend requests, and the end-to-end
verification runs including the bugs they caught.

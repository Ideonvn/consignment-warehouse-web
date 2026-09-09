# Build notes

Judgement calls, backend requests, deferrals, and the final journey result.

## Judgement calls

- **Types derived from zod.** `types/api.ts` is `z.infer` over the schemas in `lib/api/schemas.ts`
  rather than a hand-written parallel copy. One contract, no drift.
- **`images.unoptimized`.** Lot photos come from whatever host the backend seeds
  (`placehold.co` today, an object store tomorrow). Rather than maintain a `remotePatterns`
  allowlist that breaks silently on a new host, image optimization is off. Turn it back on with a
  concrete host list once the media host is fixed.
- **Money formatting locale is `en-ZA`**, with cents dropped when the amount is whole
  (`R2 500`, not `R2 500,00`). The currency code always comes from the auction, never hardcoded.
- **Server clock offset is captured from the very first response**, not deferred to M9 — it is a
  small side effect of the fetch wrapper, and every countdown then reads `serverNow()`.
- **Nothing calls `Date.now()` during render.** One shared 1s ticker samples the server-anchored
  clock outside render and hands components a `now` value (`useNow()`). This satisfies React's
  purity rules (the compiler lint enforces it) and means one interval for the whole app instead of
  one per countdown.
- **Session death is a state change, not a redirect.** A failed refresh clears the zustand store
  and the route guard reacts, which keeps navigation in React rather than in `lib/`.
- **A lot is "open" only if `status === "live"` *and* its clock hasn't run out** (`isLotOpen`).
  See the backend note below — the server keeps `status: "live"` past `effective_ends_at` but
  409s any bid, so trusting `status` alone would show a live "Place a bid" button on a dead lot.
- **Raising an existing maximum uses `PUT /auto-bid`, not `POST /bids`.** The sheet detects
  `my_auto_bid_max_minor` and switches endpoint, so raise-only semantics are enforced inline
  (strictly greater) before the server has to reject anything.
- **The pending phone number in the OTP flow lives in a store, not the URL.** Refreshing
  `/login/verify` sends the user back to `/login` rather than leaving a phone number in history.
  The *intended destination* does travel in `?next=`, because it must survive a reload.
- **Auction cards are enterable when live, scheduled or ended.** *Reversed.* This originally
  excluded scheduled auctions, on the reasoning that there is nothing to do in one yet. That was
  wrong: the decision a bidder makes before an auction opens is whether it is worth putting a
  deposit down, and they cannot make it without seeing the lots. Published now means viewable —
  browse and swipe, with saving-as-interested still working; only the bid sheet is withheld, and the
  screen says when bidding opens. Only `draft` stays hidden, which the backend enforces anyway.
- **The stack subscribes to the visible cards plus the next few (8), not the whole page.** My Bids
  subscribes to every open lot the user has money on — far below the 200-lot cap either way.
- **Lot pages have static metadata.** Per-lot titles would need a server-side fetch, but the access
  token is deliberately memory-only in the browser, so the server cannot authenticate. Titles are
  set client-side by the shell instead.

## Backend requests

- **Bidding is gated on `effective_ends_at`, never on `status`.** This is documented, intended
  backend behaviour rather than a surprise: `status` labels an *outcome*, so it stays `live` until
  the lifecycle worker has decided how the lot ended, while any bid past `effective_ends_at` is
  already refused with a 409. `isLotOpen` encodes that rule in one place and every screen uses it.
- **CORS with credentials is required.** The client sends `credentials: "include"` on every call so
  the HttpOnly refresh cookie flows; the backend must keep `Access-Control-Allow-Credentials: true`
  with a non-wildcard origin. (It does today.)
- **Expose the buyer's premium on `AuctionOut`.** *(Raised in the urgency/wording round.)* The
  column exists on the auction — the seed prints it per auction (10%, 15%, none) — but the bidder's
  `AuctionOut` does not carry it, so the new ⓘ information sheet cannot answer the one question it
  exists to answer: **"what will this actually cost me?"** A bidder who wins at R10 000 and is then
  invoiced R11 500 has been surprised by a number the platform knew all along, on a real-money
  screen. A read-only field (percentage or basis points, plus whether it applies) is all that is
  needed; the sheet already has the place to put it. Left out entirely rather than guessed at —
  inventing "typically 10–15%" on a page about money is worse than silence. Two further items the
  same sheet was asked for have **no data anywhere** and are not backend requests so much as
  product gaps: VAT treatment, and the collection address.

## Bidder accounts and deposits

- **Payment instructions are a config string, not a payment flow.**
  `NEXT_PUBLIC_PAYMENT_INSTRUCTIONS` (see `lib/config/payments.ts`, documented in `.env.example`)
  is shown on the statement and in the bid refusal. Payment is arranged manually with the operator
  today, so the fallback is an honest "contact the warehouse to pay in or top up" line rather than
  invented bank details or a fake button. Set the env var to the real wording — bank details, a
  WhatsApp number, whatever the operator wants — without a code change.
- **The deposit note on an auction card is guidance, not a gate.** It needs the balance, so the
  auction list fetches `/me/account` with `limit=1` (the smallest page that still returns the
  balance) and shares the cache entry with the Profile summary. If that call fails the card simply
  states the requirement without the "covered" reassurance; nothing is blocked either way, because
  the server decides eligibility and the 403 carries the real numbers.
- **The refusal lives in `BidSheet`**, which is the single component behind the card stack, the
  raise from My bids and the raise from lot detail — so all three paths get the same screen.
- **`shortfall_minor` is rendered verbatim.** Verified against a bidder owing R250 with a R10 000
  deposit: the panel says "Add R10 250", not R10 000.
- **Not wired:** winning a lot posts `lot_won` to the ledger, but nothing invalidates the account
  query when a lot closes, so a statement left open in another tab will not update until it is
  refetched (10s stale time, so effectively on next visit). Left alone deliberately — the statement
  is not a live screen and adding socket wiring for it would be speculative.

## Countdowns, gestures and the win

- **`refetchInterval` is the wrong tool for "act when this countdown expires", and it looked
  right.** The first implementation polled via `refetchInterval: (query) => overdue ? 5000 : false`.
  It never fired once: React Query only recomputes that callback when the component re-renders, and
  these screens do not re-render on the tick — their `Countdown` children do. So the interval was
  computed once, when the data arrived and nothing was overdue, and stayed `false`. Caught by
  watching the network during a real opening: zero requests while the page sat on "Opening…" and the
  server had already flipped the auction to live. Replaced by `useDueRefresh`, which schedules a
  timer for the boundary itself and retries every 5s until the value changes. Verified: requests at
  the opening second and one retry, then silence — no per-second polling.
- **The win check is time-triggered, not socket-triggered.** Socket events only arrive for lots the
  current screen subscribes to, so a win on an auction the user is not looking at would arrive
  nowhere. `useNewWins` watches the soonest closing time among their own bids and re-asks then, which
  is why the modal appears wherever they happen to be.
- **Skip is local by design.** No request, nothing persisted, gone on reload — so nothing
  accumulates that the user then has to manage, and it never interacts with Interested or Passed.
  If it ever needs to survive a reload, that is a product decision, not a bug.
- **Wins seen are tracked per-device in `localStorage`** (`cw.wins_seen`, capped at 200 ids). No
  backend field: it is presentation state, and the failure mode is one repeated celebration rather
  than a lost record. Clearing site data will re-announce old wins.
- **`payment_reference` is shown wherever money is requested** — statement, bid refusal, win modal —
  through a single `PaymentDetails` block, so the wording and the reference cannot drift apart.

## Known gaps

Accepted, not outstanding — deliberately not being chased.

- **`LotCardOut` carries no `currency_code`, and `SwipedList` fetches the auctions list to resolve
  it.** A lot card names only its `auction_id`, while `/me/swipes` spans auctions by design, so the
  Interested and Passed views map `auction_id -> currency_code` from the auctions list. **That extra
  fetch is intentional and should stay:** ZAR is expected to remain the only currency, so the cost
  is one cached, already-warm request rather than a schema change, and money still renders from the
  auction's own `currency_code` instead of a hardcoded symbol. If a second currency ever appears
  this stays correct as written; only the reason for keeping it changes.

## Email verification and marketing preferences

Wired into `/profile` against the new `GET /auth/me` fields, `POST /auth/email/verify/request`,
`POST /auth/email/verify` and `PUT /auth/me/notification-preferences`.

**Judgement calls**

- **Bounced is checked before verified.** A bounced address is *also* verified, so the naive order
  shows a green tick to someone receiving nothing. The bounced state offers no "resend" either: the
  server refuses a code for a verified address (422), and only correcting the address helps.
- **No "verify" prompt when there is no address.** A line saying everything goes by SMS, and a nudge
  to add one — an empty field with a verification call to action attached reads as an error.
- **The wait is rendered in minutes above 90s.** The email limiter counts per hour, so a real
  `Retry-After` here is 3600. The login flow's seconds-only wording would have shown "3591s".
- **The save button only sends moved channels**, and shows "Save change"/"Save changes" by count.
  Consent carries a timestamp, and restating an unchanged channel would re-stamp it.

**Found while building: the login code input was four boxes against a six-digit backend.**
`generate_otp_code()` returns six digits unless `APP_ENV=local` *and* `OTP_DEV_CODE` is set — which
is exactly why nobody noticed locally, where it returns `0000`. The login form hardcoded
`CODE_LENGTH = 4`, so in production the box count would never have matched the code. Both inputs now
read `OTP_CODE_LENGTH` from `lib/auth/otpCode.ts`, defaulting to 6, with
`NEXT_PUBLIC_OTP_CODE_LENGTH=4` in `.env.local` for the seeded local backend. **This is a real
production fix that happened to fall out of an unrelated feature** — worth knowing that the local
dev code was hiding it.

**Verified against the running backend** (bidder `+27820000002`, seeded local API):

| Check | Result |
|---|---|
| Address added, unverified | The block reads "Email not verified" with the SMS consequence and a send button. |
| Code requested | 200, code entry appears, four boxes matching the local dev code, resend locked for 58s. |
| Wrong code | 422 → "That code isn't right, or it has expired.", boxes cleared, resend timer intact. |
| Correct code | Flipped to "Email verified" with **no reload** — the response replaces the session user. |
| Address changed | Verification cleared **immediately**, and still cleared after a reload. |
| Bounced | Forced `email_bounced_at` in the database: the red "Email to this address is failing" block replaced the tick, and no resend was offered. |
| One channel saved | Request body was exactly `{"sms":true}`. Email kept its original 16:33 consent time, WhatsApp stayed "Not set". |
| Persistence | After a reload: SMS on with its own 20:26 timestamp, from the server. |
| Rate limit | Four requests → 429 with `Retry-After: 3600`; the button showed the wait and stayed disabled. |
| Never-asked | Empty preference rows read "Not set — we haven't asked yet", switch off, no implied refusal. |

Light theme: the "on" switch is the accent fill at 1.11:1 against the card, carried by
`--accent-edge` at 5.9:1 — the same pattern as the primary button, not a new deviation.

## Device-testing round: phone entry, focus ring, keyboard submit, undo

**`libphonenumber-js` was measured, then declined.** Bundled `AsYouType` +
`isValidPhoneNumber` + `parsePhoneNumberFromString` from the `min` metadata build with esbuild:
**157.5 KB raw, 35.7 KB gzipped** (v1.13.10). This app's entire client JS is ~350 KB gzipped across
all chunks, so the library is roughly **+10%** of everything the browser downloads — for a
mobile-first product whose bidders are almost all on one dial code. What it actually buys is
per-country *validity*, and the server is the authority on that regardless: an unusable number comes
back as a 422 either way, and the client's job is to help people get it right rather than to gate
them. So: a curated country list (Africa in full, plus the markets a South African buyer plausibly
bids from), grouping as you type, and `parseEntry` handling the three shapes people produce.

**The cost of that choice, stated plainly:** grouping is exact only where a country carries an
explicit `groups` pattern — ZA `82 123 4567`, GB `7911 123456`, NANP `212 555 0100`. Everywhere else
falls back to threes, which is countable but not necessarily how a local writes it. The list is also
curated rather than complete. Both are survivable because the escape hatch is real: any `+…` number
is accepted whole and submitted as typed, whether or not its code is in the list. If the warehouse
ever sells into a second country seriously, `formatNational` is the single seam to swap.

**A bug the assertions caught before the browser did.** Pasting `+678 555 1234` (Vanuatu, unlisted)
produced `+276785551234` — the selected country's code composed onto a number that already carried
its own, which is exactly the sort of wrong-but-plausible number nobody notices until an SMS never
arrives. Unlisted codes now resolve to `UNLISTED_COUNTRY`, whose empty dial prepends nothing. The
check that found it lives with the verification run below, not in the repo: there is no test
framework here and adding one for this was not in scope.

**The square highlight was the global focus ring, not a hover style.** `:focus-visible` in
`globals.css` draws a 2px outline on the focused element; our fields put the radius on a *wrapper*
and the focused `input` inside has none, so the ring came out square across a rounded field. The
input's `outline-none` looked like it should have prevented that and could not: Tailwind v4 puts
utilities in `@layer utilities`, and unlayered CSS beats layered CSS regardless of specificity — so
the fix had to be in `globals.css`. A `.field` class now hosts the ring on the wrapper. Verified on
every field type: phone (with its prefix adornment), profile text and email, the bid amount, the
country search — all now ring at 16px radius with the inner outline suppressed. The OTP boxes were
never affected; they carry their own `rounded-2xl`, and an outline follows the radius of the element
it is drawn on.

**Keyboard submit: what it fixes, and where it is honestly redundant.** Wrapping the bid sheet's
amount and confirm button in a form makes the action key place the bid — verified end to end: Enter
fired one `POST /bids` with `amount_minor` at the server minimum and `max_amount_minor` at the typed
ceiling, and the lot flipped to "You're winning this lot". With an amount below the minimum the
browser refused to submit at all, because implicit submission is blocked when the default button is
disabled — the guard and the keyboard path reinforce each other rather than fighting. On the **OTP
screens the form is close to redundant**: the boxes already auto-submit on the last digit, and while
the code is short the submit button is disabled, so Enter does nothing (measured: zero submit
events). It is kept for the case where someone types the last digit and reaches for the key anyway,
and because `enterKeyHint="go"` labels the key usefully either way. `Button` now defaults to
`type="button"`, without which "Resend" inside the email-code form would have submitted it.

**Undo across a mixed sequence**, verified by keyboard on a live auction, reading the top card at
each step: start lot 3 → pass → 4 → skip → 5 → interested (sheet opened, dismissed) → 6, then three
undos walked back 5, 4, 3 in exact reverse order, with the Undo button returning to disabled. The
skip undo sends nothing and the lot returns to the front on its own. The down-drag was driven with
real pointer events: with nothing to undo the top card stayed put and bounced; after a pass it
brought the lot back. The "UNDO" drag hint is absent until there is something to undo.

## Swipe hints: placement, threshold and reduced motion

The labels were pinned to `top-8 left-6` / `right-6` on the side the card travels toward, so they
left the viewport exactly when they were being read, and they inherited the card's rotation on top
of their own tilt. Replaced with one centred label that cancels the card's transform: a point at the
centre of a rotating box does not move, so undoing `x`/`y` pins it and a counter-rotation keeps it
level. **Measured**: composed screen angle 0.00° while the card sat at −3.79°, −8.94° and +9.48°.
(My first check used bounding-rect width as a tilt proxy and reported 5–7px of tilt on the armed
states — that was the 1.06 scale, not rotation. Composing the ancestor matrices is what actually
answers the question.)

**Threshold made visible**, in one language for all four gestures: pending is an outline in the
gesture's colour at 2px, armed is the same colour filled at 4px with a small scale pop. Two new
tokens: `--undo` (green was the obvious reuse and is wrong — green means *winning* in this app) and
`--on-fill`, which exists because the fills are light on dark and dark on light, so the ink flips
per theme rather than per gesture. Measured, worst case 5.89:1 in light and 6.01:1 in dark; the full
table is in CLAUDE.md.

**Legibility over photography** was tested at the extremes rather than on a typical image: the card
forced to flat white and to flat black, plus a light-theme capture over a saturated brown photo. The
label carries its own opaque background, so the backdrop only affects the surround.

**A bug the drag testing exposed.** Committing used `Math.abs(info.velocity.x) > COMMIT_VELOCITY` on
its own, with the direction taken from `info.offset.x`. Pulling one way and yanking quickly back to
centre therefore committed — offset near zero, speed high — in whichever direction the thumb
happened to land. A card reading "BID" could pass the lot. The flick now also requires the velocity
to agree in sign with the offset. Found because the test harness returned the pointer to the origin
quickly before releasing, which is exactly what a person changing their mind does.

**Reduced motion showed nothing at all.** `opacity: reduceMotion ? 0 : …` hid the labels outright,
removing the only signal of what a gesture would do from the users most likely to need it. Both
states now render under `prefers-reduced-motion`; what is dropped is the progressive fade and the
scale pop. Verified with the media feature emulated: pending and armed both at opacity 1, level,
scale pinned at 1.

**Not covered:** no seeded lot in the auctions I drove has an empty `primary_image_url`, so the
placeholder case was simulated by hiding the image rather than found in the data.

## Three browsing layouts

Cards, list and gallery over one lot set. No backend change and no new API field — the one thing
that wanted a field is covered below.

**What moved.** `useLotStack` became `useAuctionBrowse` (rename landed separately so this diff is
readable) and is now called once by the screen rather than by `CardStack`, which is what lets three
renderers share one set, one history and one `PUT /swipe` path. It grew `remaining` (the set, lot
order) alongside `cards` (the stack's ordering of it), plus `openAt`, `hasMore` and `loadMore`.
`CardStack` lost the hook call, the toast wiring and the bid sheet, and gained two props; its
gestures, buttons and keys are untouched.

**The history moved into a store** (`lib/browse/browseSession.ts`), keyed by auction. It had to: the
layout switcher is on `/profile`, so switching means leaving the screen, and component state would
have emptied the undo history and the skip order every time. Memory-only, so a reload still clears
it — CLAUDE.md's skip wording was updated to describe the new lifetime rather than leave a rule the
code no longer follows.

**Judgement calls**

- **First run asks on entering an auction, not after sign-in.** Mounting it app-wide would have put
  the question over the auction list, where "cards", "list" and "gallery" have nothing to refer to.
  Dismissing stores the default, so it is asked exactly once either way.
- **`active_only=false` for the leading badge**, as instructed: absent / leading / outbid is three
  states where `true` gives two and hides the useful one. The endpoint caps at 200 with no offset, so
  full paging is impossible from the client; a saturated response renders unmatched lots as
  **unknown** with a notice, never as "no bid".
- **320ms hold on a resolved row**, driven by a timer with the animation layered on top, so reduced
  motion keeps the protection.
- **No virtualisation**, on a measurement rather than a hunch: 250 lots is 2,839 DOM nodes, a 22,107px
  document, median frame 13.3ms and a single frame over 50ms (the first paint).

**Two bugs found by driving it, not by reading it**

1. **Undo across a layout switch deleted the swipe and changed nothing.** Dropping the history entry
   is only half an undo — the lot also has to be back in the set, and the set comes from pages the
   server built while the swipe still existed. Undo now invalidates the lots query. Caught by the
   exact scenario in the brief: pass in the list, switch to cards, undo twice.
2. **The list and the gallery only ever showed the first page.** Paging was triggered by the stack's
   "fewer than six cards left", which for a layout showing everything at once means page two arrives
   only after you have resolved 14 lots. Both scrolling layouts now page from a sentinel.

**Verified against the running backend** (seeded auctions, live and scheduled):

| Check | Result |
|---|---|
| Same set in every layout | Gallery and list rendered identical lot lists (20/20) across a round trip, with a lot passed in the list absent from both. |
| Resolve in list → gallery → back | Sets agreed each time; the passed lot stayed gone. |
| Undo across layouts | Pass lot 5 (list) → skip lot 6 (stack) → undo restored 6, then 5; Undo then disabled. Newest first, across two layouts. |
| Open at a tile | `?at=12` opened the stack at lot 12 with 14 and 16 behind it — the next lots in order. |
| Passing the anchor | Continued at 14, did not snap back to lot 1. |
| Gallery reflow | Left from lot 16 at offset 166px, resolved it, returned: lot 17 sat at offset 166, scroll drift 0. |
| Vanishing row | 80ms after a pass the row was still present, inert, and the button below had moved 0px; gone by 600ms; "Lot 1 passed" announced. |
| Reduced motion | Same hold, transition disabled (1e-05s), row inert, 0px shift. |
| Sign-out | Bidder A left a skip, signed out, bidder B signed in: Undo disabled, nothing inherited. |
| 360×480, scheduled auction | Stack keeps its banner and all three buttons clear of the nav; list and gallery scroll with the last item clearing the nav by 26–27px; no horizontal overflow. |
| Keyboard | List tab order is row → Pass → Bid → next row; the stack keeps its arrow keys. |
| Scale | 250 lots paged in by scrolling, 20 → 250. |

**Test data left behind:** two auctions created through the admin API — "Layouts Tight Case"
(scheduled, 6 lots) and "Scale Test 250" (scheduled, 250 lots). Delete them when convenient; they
exist only for the height and scale measurements.

## One-tap bidding on the stack

A right swipe on the card stack now places a bid, five seconds after the gesture, with a visible
countdown and a Cancel in the row where the action buttons normally sit. **Nothing is sent during
the window** — it is a delay before `POST /bids`, not an optimistic write that gets undone — so a
mis-swipe costs nothing. The list is unchanged and its button is now labelled "Bid…".

**Scoped without forking the hook.** `decide(lot, direction, { commit: true })`: the option is set
at the call site, so the stack's swipe, its Bid button and its right arrow commit while the list's
button does not. Deriving it from "which layout is mounted" was rejected — it is the affordance that
differs, not the screen.

**No new API field was needed.** `max_amount_minor` is `int | None` on `BidCreateIn`, and
`bidding.py` computes `effective_max = max(amount_minor, 0)` when it is absent, which is exactly a
bid with no headroom. `useBidSubmit` now takes `maxAmountMinor: number | null` and omits the field.

**Backgrounding cancels rather than commits** — reversed from the original instruction, on the
asymmetry: an interruption the user did not choose (a call, a notification, the lock screen) should
not convert a cancellable window into an unretractable bid. Cancelling costs immediacy only, since
the swipe is still recorded and the lot is in My bids. It also deletes the `pagehide` problem
entirely: no keepalive fetch with a possibly-expired token, and no bid whose outcome nobody can
know. The window is never resumed on return — a bid firing minutes later at a moved price is worse
than either alternative.

**Three undo states, one control.** A running window: cancel and undo the swipe, nothing sent. A
cancelled or plain swipe: as before. A swipe whose bid already went out: the swipe is undone and the
toast says *"Your bid still stands — a placed bid can't be taken back"*, because there is no
retraction API and implying otherwise would be a lie about money. `browseSession` gained a
`bidPlaced` flag to make that wording truthful.

**Refusals roll back by lot id, not by "undo the newest".** Five seconds is long enough to have
swiped two more cards, and undoing one of those instead would be its own bug.

**A bug found by driving it:** the timer committed the pending bid without clearing the slot, so the
countdown stayed on screen after the bid had gone and the next deliberate action would have flushed
the *same* bid again — only the idempotency key stood between that and a duplicate. Both the timer
and the flush now go through a single `takePendingBid()` that empties the slot and returns it in one
step.

**Verified against the running backend**, network log as the source of truth:

| Check | Result |
|---|---|
| Cancel inside the window | **Zero `POST /bids`**, from the request log — only the `PUT /swipe` |
| Let it elapse | One `POST` → 200, strip cleared, buttons back, "You're winning lot 2" |
| Swipe then swipe the next card | Exactly one `POST`, one `client_request_id` |
| Two right-presses in a row | One `POST`, one request id |
| Already bid on that lot | Sheet opens immediately, no window, no `POST` |
| Deposit shortfall | 403 → "You have R 4 999,99 / needs R 5 000 / **Add R 0,01**" — the server's `shortfall_minor`, plus reference `cb-0826` |
| Lot closed mid-window | Clock patched to expire inside the window: 409 → "That lot closed… nothing was placed and nothing was charged" |
| Rate limited | Real limiter tripped at request 61 on one lot: 429 → "too many bids on this lot. Try again in 33s.", lot restored |
| Tab hidden mid-window | Zero `POST` then or 6.5s later; strip gone; "bid not placed… saved in My bids"; not resumed on return |
| Undo after a placed bid | "Lot 2 is back — Your bid still stands…", no second `POST` |
| Reduced motion | Countdown and Cancel present, drain bar `display: none` |
| 360×480, live auction | Strip clears the nav, Cancel 94×56, price clears the strip by 7px, no page scroll |
| List untouched | "Bid…" opens the sheet, no window, zero `POST` after six seconds |

**Reflex tap:** the old Bid button's centre lands inside Cancel's box (Cancel spans x 267–361; Bid's
centre was 267,704 with a 56px box, ~42% overlap). A thumb going back for "Bid" therefore hits
Cancel or the inert text beside it — never a second bid and never a pass. Cancel then says nothing
was sent and the lot is in My bids, so it reads as a correction.

**Test data:** a no-bid lot in Autumn Fine Jewellery had its clock moved to test the 409, and ~61
deliberately-invalid bids were fired at Autumn lot 5 to trip the limiter (invalid, so no prices
moved). Both are seeded-data artefacts, not product state.

## Anonymous browsing and shareable links

Public auctions readable with no account, on the same URLs members use, with real link previews.

**Routing: one group, guard in the layout, allowlist beside it.** Splitting `(app)` into sibling
groups would have remounted `RealtimeProvider` — and dropped the socket — every time someone moved
between an auction and My bids, because sibling groups have sibling layouts. Moving the guard down
onto the private pages instead would have inverted the failure direction: a new page would ship
public unless someone remembered. So the guard stays in the layout and `lib/auth/publicPaths.ts`
lists the three paths that are open. A typo there leaves a public page guarded, which is loud and
harmless; the opposite mistake would be silent and would expose a ledger.

**`LotSummary` rather than a mode flag.** The public shapes have no `my_swipe`, `am_i_leading` or
`bid_sequence` at all, so the presentational components were narrowed to the structural type both
sides satisfy, and member affordances arrive as an optional `actions` prop. Three route-level checks
decide mode; nothing below asks. `LotList` and `GalleryLayout` also stopped taking the whole
`AuctionBrowse` object, which is what let them serve both callers.

**A separate public client, and the refresh logic untouched.** The deciding reason was
`generateMetadata`: it runs in Node, and `lib/api/client.ts` reaches into the session store and the
clock offset — module-level state that a server process shares across concurrent requests. That
would have been intermittent and horrible to diagnose. Also: no cookies, no reachable `endSession`,
no `SessionExpiredError` in anonymous traffic.

**Metadata caching.** `next: { revalidate: 30 }`, matching the endpoint's `max-age=30`. It has to be
explicit — App Router fetches are uncached by default and Next does not derive a TTL from upstream
`Cache-Control` — otherwise a crawler walking 250 lots is 250 origin requests, each eu-west-1 to
af-south-1. `metadataBase` comes from a new `NEXT_PUBLIC_SITE_URL` (threaded through `.env.example`
and Terraform), because without it Next resolves `og:url` and any relative image against localhost.

**Poll ladder:** 10s live, 5s once a visible lot is inside its anti-snipe window, 60s scheduled,
nothing when ended; paused while hidden, stopped after ten idle minutes. 5s is the floor the
endpoint's `max-age` sets, and outside the close this model moves in minutes, so 10s costs nothing
perceptible and halves the traffic.

**Verified against the running backend** (Spring Collectables switched to `public` via the admin
API), storage and cookies cleared:

| Check | Result |
|---|---|
| Anonymous walk: list → auction → lot | Catalogue, 24-tile gallery, read-only lot page |
| `Authorization` headers on any request | **Zero** |
| Action buttons anywhere anonymous | **Zero** — not disabled, absent |
| Nav for anonymous | No tabs; one "Get started" bar |
| Public lot `<meta>`, from `curl` | `<title>Lot 1: Spring Collectables lot 1 · …`, `og:title`, `og:description` ("Starting at R 99 · 0 bids · …"), absolute `og:url` and `og:image`, `twitter:card=summary_large_image` |
| Private lot / private auction, from `curl` | Generic `<title>Consignment Warehouse</title>`, **no `og:*`**, and the private auction's name appears **0 times** in the served HTML |
| Signed in, same URLs | Card stack, Pass/Skip/Bid/Undo, three nav tabs, no CTA bar |
| Auction made private mid-browse | "This auction is no longer available" within one poll (<4s) |
| Same URL, fresh visitor | "We couldn't find that auction" — ordinary not-found |

**One deviation from the brief, stated plainly.** The walk shows no `Authorization` header anywhere,
but there *is* one `POST /auth/refresh` per full page load, from `SessionBootstrap` probing for a
session. It is not a public-client request — it returns 401 and resolves the visitor to anonymous —
and it does not block the public content, which renders immediately when no `cw.had_session` hint is
present. Skipping the probe when the hint is absent would remove it, at the cost of signing out
every existing session whose localStorage has been cleared but whose cookie is still valid. That
trade seemed the wrong way round to make silently, so it is left as is and flagged here.

**Found while verifying:** a 404 arriving while a visitor was already reading left the stale page up,
because the auction and lot queries were sitting on cached data with no reason to re-ask. The price
poll is the only thing still talking to the server, so its error now feeds the same surface — and
404s are no longer retried, since private, draft and missing are all answers rather than hiccups.

## Backend surface adopted

The backend was extended in response to the requests above, and the client workarounds they
justified are gone:

- **`GET /me/swipes?direction=&limit=&offset=`** replaced the per-auction fan-out. The Interested
  and Passed views now make one paged call each and render the returned lot cards directly, in the
  server's most-recently-swiped order (`lib/hooks/useSwipedLots.ts`). Currency is resolved from the
  auctions list by design — see Known gaps.
- **`AuctionOut.lot_count`** is shown on each auction card.
- **`subscribe.after_sequences`** replaced the scalar compromise. Each lot now resumes from its own
  sequence, so a batched reconnect neither replays nor skips. The de-duplication added when the
  scalar form forced replays is kept as a safety net. A `bad_after_sequences` error is handled
  explicitly: it is logged, the batch is resubscribed without resume hints, and those lots are
  refilled over REST rather than left with an invisible hole.
- **`FrozenFieldOut`** is a documented `{message, field}` pair, so the speculative plural handling
  is removed.
- **`lot_rescheduled`** is fully specified and carries `scheduled_ends_at`, `effective_ends_at` and
  `extension_count`. It is applied as an absolute value, so an admin pulling a close time *earlier*
  shortens the countdown — unlike `lot_extended`, which only ever moves later.

## Resolved on the backend

Both of these were reported from here and have since been fixed upstream. Recorded so nobody
re-raises them, and because the second one has a lesson attached.

- **Reversal descriptions no longer leak the internal type name.** They used to read
  "Reversal of lot_won: …" on a customer-facing statement. Ledger entries now build the description
  through a customer-facing label map, so it reads "Reversal of Lot won: …", and a test asserts no
  entry type's label contains an underscore. The client still maps `entry_type` to its own label
  for the row heading (`lib/format/account.ts`) — that stays, because the heading and the
  description are separate strings.
- **`AuctionCreateIn` now persists `deposit_amount_minor` and `buyers_premium_bps`.** The create
  endpoint builds from the payload's own fields, and a contract test asserts every field on the
  create schema round-trips to the database — driven from the schema itself, so a new field cannot
  go missing the same way.

  **Worth keeping in mind:** while this was broken it cost real time here, and not by failing
  loudly. Creating an auction with `deposit_amount_minor: 5000000` silently stored `0`, so a
  deposit-gate test "passed" a bid that should have been refused — a **false negative** that looked
  like working software. It was only caught by reading the auction back and finding the field at
  zero. When a test of a gate passes on the first try, confirm the gate was actually armed; the
  cheap version is to read the fixture back rather than trusting the write. Note also that the
  matching `PATCH` is refused once bidding has started (`deposit_amount_minor cannot be changed
  once bidding has started`), so an auction created before this fix can only be corrected while it
  still has no bids.

## Resolved — not a backend bug

An earlier run of this document reported that **no `lot_closed` event arrived when a lot's clock ran
out**, and listed it as a backend gap. That was wrong, and nobody should re-investigate it.

The lifecycle worker was simply not running during that run: a Docker Compose problem was silently
failing `make deps`, so `make dev` came up without it. No lot ever actually closed, so no event
could be published. The worker builds `LotClosedEvent` and publishes it (`app/worker/main.py`), and
with the full stack up (`make dev-all` + `make seed`) every lifecycle event verified first time —
`lot_closed`, `lot_opened` and `lot_extended` all arrive, with the payloads the spec describes.

## Deferred

- **Per-lot `<title>`/OG metadata** — needs authenticated server rendering, which conflicts with
  the memory-only access token. See the judgement call above.
- **Bid history live-splicing.** A `bid` event invalidates the paginated history and lets it
  refetch, rather than splicing the new bid into page one. Simpler and always correct; costs one
  small request per bid on the lot detail screen only.
- **Image optimization** — off until the media host is settled.

## Lifecycle and realtime verification (full backend, worker running)

Re-verified against `make dev-all` + `make seed`, driving a real browser with the app's WebSocket
frames recorded, and a second and third seeded bidder acting as rivals. Test auctions were created
through the admin API so that opens, closes and the anti-snipe window could be triggered on demand.

| Test | Result |
|---|---|
| `lot_closed` over the socket | **Pass.** Three lots closing in the same tick delivered three events with distinct statuses: `ended_unsold` (no bids), `ended_reserve_not_met` (bid below reserve), and `ended_sold` (bidding pushed above reserve). |
| Terminal states render differently | **Fixed, then pass.** They previously all collapsed into "Closed". See the fix below. |
| `lot_opened` over the socket | **Pass.** A scheduled lot, watched from its detail screen, received `lot_opened` on the worker tick and became biddable without a reload. |
| Anti-snipe `lot_extended` | **Pass.** A bid 1:44 from close produced `lot_extended` and the countdown moved to 4:56 with no refetch. |
| Anti-snipe on the POST response | **Pass.** The same bid's `POST /bids` response carried `extended: true`, `extension_count: 1` and the new `effective_ends_at`. |
| Resync with `after_sequence` | **Fixed, then pass.** Reconnect now resubscribes with `after_sequence: 1` and the server replays sequences 2, 3, 4, 5 — gap-free, no duplicates — followed by `resync_complete` at `latest_sequence: 5`. The screen went R2 500 / 1 bid → R2 650 / 5 bids. |

### Defects found and fixed during this pass

1. **Reconnect had no resume point (the big one).** The client only learned a lot's `sequence` from
   bid events it had already seen over the socket. On a fresh page load nothing had been seen, so
   `lastSequence` was 0, the resubscribe carried no `after_sequence`, and **every bid placed during
   an outage was lost** — no replay, and the price stayed stale until something else refetched.
   Proved it by blocking the socket, placing two bids, and watching the reconnect subscribe blind.
   Fixed by seeding the resume point from REST: `useLotSubscription` now takes each lot's
   `bid_sequence` alongside its id, so the resume point exists from first render.
2. **The three terminal states were indistinguishable.** Every closed lot read "Closed", so a
   bidder who won a lot and a bidder on a lot that never met its reserve saw the same thing.
   `lib/format/lotStatus.ts` now maps status (plus "am I leading") to a label, a tone and a
   sentence, used by the card face, lot detail, My Bids and the swiped lists: "You won" / "Sold" /
   "Reserve not met" / "Unsold" / "No bids" / "Withdrawn" / "Cancelled".
3. **Scheduled lots read as closed.** A lot that had not opened yet showed "Closed" and "Bidding
   closed" — the same wording as a finished lot. It now shows "Opens in <countdown>", an explicit
   "Bidding hasn't opened on this lot yet", and a disabled "Not open yet" button.
4. **A won lot still offered "Stop auto-bidding".** The auto-bid controls rendered regardless of
   whether the lot was still open, so a bidder who had just won one was invited to cancel automatic
   bidding on it. Both controls are now hidden once the lot closes; the maximum itself stays visible.
5. **Batched replays could rewind a price.** Because `subscribe` carries one `after_sequence` for
   the whole batch (see above), a reconnect replays bids that some lots have already applied — and
   applying an old bid would overwrite the current price with a stale amount. Bid events at or
   below the last sequence seen for that lot are now dropped. The batching is confirmed from the
   wire (an observed resubscribe carried `after_sequence: 4` for three lots at different
   positions); the drop itself is a guard against that, not something I saw fire.
6. **`minimum_next_bid_minor` went stale after socket updates.** Neither `bid` nor `resync_complete`
   carries the new minimum, so "Next bid from …" kept the pre-bid figure — and the bid sheet would
   open on it and take a recoverable 422. The lot is now refetched when a bid lands on a lot that is
   actually loaded, which costs one small request per bid on the screen being watched.

### `resync_too_far` falsification run (carried since the realtime pass, now done)

Reverted `store.noteSequence(...)` in the `resync_too_far` branch of `lib/realtime/events.ts` and
drove the reverted build against the real backend, on `spring-collectables` lot 9 (255 bids, replay
cap `WS_RESYNC_MAX_EVENTS=200`, so any resume point below ~55 is refused). The tracked sequence was
forced to 1, and every reconnect was forced by closing the socket from the page.

| | reverted | restored |
|---|---|---|
| resume point sent on each reconnect | `1`, `1`, `1` — never advances | `257` |
| server reply | `resync_too_far` ×2 per reconnect, three rounds running | `resync_complete` ×2, zero refusals |
| REST refetches caused | 2 per reconnect, indefinitely | 2 once, at the single genuine refusal |

Non-terminating in the reverted build: three identical rounds, the tracked sequence pinned at 1.
The line is load-bearing and stays.

**It also corrected the reason.** I had written that the reverted code makes *every later bid* look
like a fresh gap. It does not, and the run showed it: after the refused resync, the next bid
produced **zero** further resyncs, because the `bid` branch calls `noteSequence` unconditionally
right after asking for the replay, so a single bid event repairs the tracked position on its own.
The leak is per *reconnect*, not per bid — nothing between reconnects repairs the resume point on a
lot that is quiet, so a stale one is re-sent and re-refused for the life of the page, each round
costing a full REST refetch. Worst on exactly the lots that can afford it least: a page left open on
a slow connection. CLAUDE.md's wording is corrected to match.

Both the revert and a temporary `window.__rt` hook (used to force the resume point without waiting
for 200 real missed events) were removed afterwards; `git diff` on `lib/realtime/` is clean and the
gate was re-run.

## M10 journey result

Walked end to end against the complete backend (API + lifecycle worker, `make seed` applied) in a
390×844 viewport as `+27820000004`, with `+27820000002` and `+27820000003` as rival bidders.

| Step | Result |
|---|---|
| Log in with `0000` | **Pass.** Signed out through the UI, re-entered `+27820000004`, typed `0000` digit by digit; it auto-submitted on the fourth and landed back on `/profile` — the destination the sign-out had come from. A hard reload then restored the session from the HttpOnly cookie alone. |
| Browse auctions | Pass. Live auctions first with live pills and closing countdowns; scheduled ones listed as "Opens soon" and not enterable. |
| Enter a stack | Pass. Three cards deep, unswiped lots only, ordered by lot number. |
| Swipe left (drag) | Pass. Card tracks the pointer 1:1, "Pass" intent fades in, flies out left, `PUT /swipe {pass}` recorded. |
| Swipe right (drag) | Pass. Records `interested` **and** opens the confirm sheet; the lot leaves the stack either way. |
| Confirm a bid | Pass. Sheet showed the raise-only wording against the user's existing R2 500 maximum, and confirmed "You're winning at R2 500" with the new ceiling at R2 550. |
| See it in My Bids | Pass. Grouped Winning / Outbid / Ended with each row's own maximum. |
| Open lot detail | Pass. Gallery, price, minimum next bid, reserve marker, own maximum, bid history with own bids marked and auto-bids labelled. |
| Raise the maximum | Pass. `PUT /auto-bid`; raising while leading moved neither the price nor anyone else's view, as designed. |
| Rival bids higher | Pass. Third bidder outbid from a separate session. |
| First window updates live | Pass. R2 500 → R2 600, bid count 13 → 14, minimum next bid corrected to R2 650, `am_i_leading` flipped, price pulsed, and an "You've been outbid" toast with a one-tap raise. |
| Let a lot close | **Pass.** A lot the user was winning closed on the worker tick: `lot_closed` with `status: ended_sold` arrived over the socket and the My Bids row moved Winning → Ended live. |
| Ended lot renders correctly | **Pass.** That lot reads "You won" / "You won this lot."; a lot that closed below reserve reads "Reserve not met" / "Bidding ended below the seller's reserve, so this lot didn't sell."; a lot with no bids reads "No bids" / "This lot closed without a single bid." |

**On the login step:** partway through this run the backend's OTP rate limiter locked this IP out
(`429`, `Retry-After: 2238`) after the many sign-ins the verification needed. The browser session
itself was unaffected — it refreshes from its HttpOnly cookie — so the rest of the journey ran
normally, and the login step was run last, once the limiter released and a request returned `200`
again. Worth knowing that a heavy scripted test run will hit the 10/hour per-IP cap; the app's own
`429` handling on `/login` was therefore never exercised through the UI.

### Test data left behind

Verification created several auctions through the admin API — "Verification Run", "Verification
Closes", "Verification Anti-snipe", "Verification Sold", "Verification Opening", "Verification
Scheduled" and "Journey Finale" — plus bids on the seeded Spring Collectables lots. They are
harmless but visible in the app; `make seed` on a fresh database clears them.

---

# Simplification round (list-only, no swiping, gold palette)

Everything above this line is the build record of the **card-stack** product. Several entries in it
are now history rather than description — specifically "Skip is local by design", the swipe-hint
section, "Three browsing layouts", "One-tap bidding on the stack", and the gesture halves of
"Countdowns, gestures and the win". They are kept because they record *why* those things were built,
which is the useful part when someone asks whether reversing them was reasonable. `CLAUDE.md` is the
description of the app as it stands.

## What this round changed

The card stack, the photo gallery, the layout preference and first-run chooser, all four gestures,
undo, skip, the browse-session store, the swiped lists, and the five-second pending-bid cancel
window were deleted. The list is the only layout, with two buttons a row and no pass. The accent
moved from lime to the logo's gold. Lot detail letterboxes and opens full screen with pinch-zoom.

## Judgement calls this round

- **The cancel window's removal is a real loss, recorded as one.** There is still no bid retraction
  API, so a mis-tap is now irreversible where it previously was not. The window went because
  stakeholders found the delay confusing. What replaced it as protection: the amount is on the
  button before the press, and a per-lot in-flight guard plus a fresh `client_request_id` stop a
  double tap becoming two bids. That guard is not optional — it is the only thing left.
- **`skip` was deleted with the stack, not with the swipes.** It only ever re-ordered the stack's
  card list; once that ordering went, skip pushed history entries nothing read.
- **`useLotActions` was rewritten rather than deleted.** One path to `POST /bids`, one to the sheet,
  plus the in-flight set. `useAuctionBrowse` was kept too, much thinner, as the member counterpart
  to `usePublicAuction` — the symmetry is what lets one `LotList` serve both modes.
- **`my_auto_bid_max_minor` is read through one narrow cast in `LotList`**, not by widening
  `LotSummary`. `LotSummary` is the shape both member and public cards satisfy; widening it would
  destroy the guarantee that a public row cannot render a member affordance.
- **`--on-fill` was kept and repurposed**; `--undo` was deleted. `--on-fill` encodes that ink on a
  filled mark inverts between themes, which the new final-minute countdown needs.
- **framer-motion survives on a weaker brief.** Four files use it (`Sheet`, `Toast`,
  `ConnectionBanner`, `WinCelebration`) — none of them a gesture. Flagged in `CLAUDE.md` as a
  removal candidate rather than removed here, since that is a separate change with its own risk.
- **The 320ms list-row hold was removed.** It guarded against a row vanishing under a finger and
  dropping the next row's Pass button into the same pixels. Rows no longer vanish and there is no
  Pass, so the hazard was deleted before the guard was.

## Verification, driven against the running backend

`make dev-all` (API on `0.0.0.0` so a phone can reach it) plus `make seed`; shapes read from
`/openapi.json` rather than assumed. Bidder `+27820000002`, rival `+27820000003`, no-deposit bidder
`+27820000034`, admin `+27820000001`.

| Check | Result |
|---|---|
| Two buttons a row, amount from the server | Pass. `Bid R 99`, `Bid R 1 200`, `Bid R 38 000` — each equal to that lot's `minimum_next_bid_minor`. |
| One immediate `POST /bids`, no confirmation | **Pass.** Exactly one request, body `{"amount_minor":9900,"client_request_id":…}` — **no `max_amount_minor` at all**, which is how "no maximum" is expressed. No dialog in the DOM 120ms after the press. |
| Sheet sends the ceiling separately | **Pass.** Typed R2 000 on a R1 200 lot sent `{"amount_minor":120000,"max_amount_minor":200000}`; the lot went to R1 200, not R2 000. |
| Left button flips to "Raise Maximum" | Pass, from the cache writer with no refetch. Also flips after a *plain* bid, because the backend sets the maximum to the bid — faithful, and noted as a known gap. |
| Increment chips gone | Pass. The sheet's only controls are Confirm and Not now. |
| 403 deposit shortfall | Pass. R0 bidder into a R5 000 auction: "You have R 0 on account / This auction needs R 5 000 / Add R 5 000", with the payment reference. |
| 429 from the real limiter | **Pass.** 60 bids accepted, the 61st returned `429` with `Retry-After: 59`; the UI then rendered "too many bids on this lot. Try again in 34s." |
| 422 someone bid first | **Pass.** A real rival bid lot 15 to R8 500 from a second session; the stale row's press returned the server's new minimum — "The minimum is now R 8 750." |
| 409 lot closed | **Pass.** An admin withdrew lot 16 while the page still showed it live. Copy was corrected during this run: it claimed the clock ran out, which is not the only cause of a 409. |
| Clock, not `status`, gates the buttons | Pass. Both buttons disabled together on a closed lot and on a scheduled auction. |
| Final-minute alarm | **Pass, measured across a real crossing.** At 1:28: transparent, weight 400, 12px, no animation. At 0:59: `--danger` fill `rgb(255,90,90)`, `--on-fill` ink, weight 700, 14px, `urgent` running. |
| No reflow at the crossing | **Pass.** Clock line 24px and row 167px at *both* 1:28 and 0:59 — `min-h-6` reserves the alarm's height up front. |
| Reduced motion keeps the urgency | **Pass.** With the reduce block applied, `animation-duration` collapses to 1e-05s and the element settles at **opacity 1, transform none** — the full-strength frame, not the dim middle — with fill, ink, weight and size unchanged. |
| Letterbox on lot detail | **Pass.** `object-fit: contain` on every slide; a 900×1200 portrait renders whole with black bands in a 390×293 frame. A 4:3 photo fills the 4:3 frame exactly, which is correct, not a missing band. |
| Full-screen viewer | Pass. Opens on the tapped photo (3/6), `role="dialog" aria-modal="true"`, `touch-action: pan-x pinch-zoom`, page scroll locked and restored, Escape closes. |
| 360×480, scheduled auction | Pass, signed in and anonymous. Rows and both buttons fit; nothing under the nav. |
| Both themes | Pass. Light `--accent-edge` `#806200` visibly holds the gold button's boundary against white. Green still means winning, distinct from the gold. |
| Server-side two-week exclusion | Pass. `harvest-clearance-long-past` (ended > 2 weeks ago) is absent from `/auctions`, and the client adds no filter of its own. |
| Console | Clean. Two pre-existing Next.js LCP hints about list thumbnails; no errors. |

**Not verified: pinch-zoom on physical hardware.** I have no access to a phone, so the one check that
was specifically called out as needing real hardware is the one I could not run. What *is* verified
is everything the implementation controls: `touch-action: pan-x pinch-zoom` is applied to the
full-screen track, the viewport permits scaling (`maximum-scale=5`, no `user-scalable=no`), and no
JS touches the gesture — the browser is being asked to do it. To confirm in thirty seconds, open
`http://<LAN-IP>:3000/lots/<id>` on a phone on the same network, tap a photo, and pinch.

### Environment notes for the next person

- `make dev-all` binds uvicorn to `127.0.0.1`. For a phone (or for a browser on the LAN IP) run the
  API with `--host 0.0.0.0` and point `S3_PUBLIC_URL_BASE` at the LAN IP too, or lot photos resolve
  to `localhost:9100` and never load off-device.
- **Serve the web app from the same host as the API.** With the page on `localhost:3000` and the API
  on `192.168.1.184:8000`, the refresh cookie is cross-site and is not sent, so every reload lands
  as an anonymous visitor. Use the LAN IP for both.

### Test data left behind

This run withdrew Spring Collectables lot 16, rescheduled two auctions, and placed ~65 bids on lot
1. **`make seed` was re-run afterwards**, so the database is back to the documented dataset.

---

# Urgency-and-wording round (clock tiers, constant labels, in-card alerts)

Round 2 of stakeholder feedback asked for **clearer, less technical wording** and **much more
urgency near a lot's close** — the second being close to the opposite of round 1's "fewest buttons,
cleanest screen". The organising rule that makes both true at once is recorded at the top of
`CLAUDE.md`: **urgency is a function of the clock, not a permanent feature of the layout.**

## What this round changed

- The left button is a constant two-line **AUTO BID / Set your maximum**. The maximum moved to a
  data line, `Your auto bid: R2 500`, present only when there is one.
- The right button is **BID R1 200** (uppercase), amount still through `Money`.
- The lot number is a gold `--accent` pill, top-right, on the title's own line.
- All four bid states carry an icon *and* a word: WINNING / OUTBID / NOT BIDDING / BID STATUS
  UNKNOWN. `unknown` survives as its own state.
- `Countdown` gained five clock tiers and escalates on its own; the existing final-minute alarm was
  extended down to the final hour rather than rebuilt.
- `AuctionCloseBar`: a quiet `29 lots · Closes Monday, 14 September at 19:37` line that becomes a
  pinned **NEXT LOT CLOSES** alarm inside the final hour, derived from the minimum open lot clock.
- In-card transient alerts for `bid`, `lot_extended` and `lot_rescheduled`, all off the existing
  socket fan-out.
- `AuctionInfoSheet`: a ⓘ on the auction header, built only from fields `AuctionOut` already has.
- Card separation: `gap-3`, the existing full border, and one new token `--card-shadow`.

## Judgement calls this round

- **The gold left-edge accent on cards was declined.** `--accent` is the bid button's colour and the
  lot pill's; putting it on every card edge dilutes the one thing on screen that means "press me".
  The neutral border plus space separates just as well. (Had it been taken, that edge would have
  needed `border-radius: 0` or it renders as a detached sliver.)
- **The sticky header reads "NEXT LOT CLOSES", with the lot number beside it and the pill below.**
  The stakeholder's phrase was "NEXT LOT CLOSES IN"; the countdown's own hour-tier wording is
  `09:42 left`, so the literal phrase would have read "NEXT LOT CLOSES IN 09:42 left". The label
  keeps the meaning, and naming the lot ("Lot 3") is worth more than the preposition.
- **`plain` now suppresses the whole escalation, not just the alarm.** An auction-level clock keeps
  the exact wording and format it had. That is the smallest possible diff at the ten `plain` call
  sites and the honest reading of the existing rule: a clock nobody bids against should not adopt a
  bidding deadline's language either.
- **`mm:ss` is zero-padded through the final hour** (`09:42`, `00:42`), where the last minute used
  to render `0:42`. Fixed width is what keeps the pill from reflowing as it counts down, which the
  no-reflow requirement cares about more than the leading zero.
- **The extension alert states the *measured* jump, not the configured window.** A bid at 3:26
  remaining moves the close to now + 5 min, a gain of ~1:34 — "extended by 5 min" would be wrong
  about what just happened on screen. If no cached close time is available to measure against, the
  sentence stops at "extended" rather than inventing a figure.
- **`lot_rescheduled` never borrows the extension's words.** It says "Closing time changed … now
  closes 8 min earlier / later", because an admin cascade moves clocks in either direction.
- **The list's own `{lots.length} lots` line was deleted.** With the auction's `lot_count` on the
  header line, the two disagreed while paging.
- **The ⓘ sheet is member-only.** `publicAuctionSchema` carries no anti-snipe fields and an
  anonymous visitor has no payment reference, so there is nothing honest to put in it.

## Verification, driven against the running backend

`make dev-all` + `make seed`, Chrome at 360×480, real login (OTP `0000`), real socket. Full-page
reloads drop the refresh cookie when the API is reached on a different host than the app, so the
harness navigates client-side after signing in (this is already recorded above, under environment
notes).

**Three real defects were found by driving it, none of which would have shown up in review:**

1. **`Intl.DateTimeFormat` threw on load.** The zoned formatter for the ⓘ sheet combined
   `dateStyle`/`timeStyle` with `timeZoneName`, which Intl rejects — `TypeError: Invalid option :
   option`, at module evaluation, taking the whole client bundle down. Rebuilt from component
   options.
2. **A bidder's own bid announced itself back to them** as "Another bidder just bid R99". The socket
   echo routinely arrives *before* the bid's own HTTP response, so recording the `is_mine` sequences
   from the response was always a step too late. Fixed by claiming the lot in `expectOwnBid` at send
   time, with the exact sequences taking over when the response lands.
3. **A stale `WINNING` badge sat beside "Another bidder just bid".** The `bid` handler only
   invalidated `/me/bids` when a *lot-detail* cache entry existed, which it never does on the list
   screen. Now `patchMyBid` reports whether the row was the caller's and the query is re-asked
   exactly when it is. A lie about someone's own money is not a cosmetic bug.

Also corrected before shipping: `formatDuration` could only express seconds/minutes/hours, so an
admin cascade produced "now closes 7120 min earlier".

### Clock thresholds, crossed live and measured

Each lot clock was set a few seconds above a boundary and the crossing watched happen on the ticker
— no reload, no refetch — with the row height read either side, at 360×480:

| Crossing | before | after | height |
|---|---|---|---|
| 48h | `Closes in 2d 0h` | `Closes Friday at 19:52` | 181px → 181px |
| 24h | `Closes tomorrow at 19:52` | `23h 59m left` | 181px → 181px |
| 1h | `1h 00m left` | `59:56 left` | 181px → 181px |
| 60s | `01:02 left` | `00:56 left` | 181px → 181px |

### The alarm, with and without `prefers-reduced-motion`

Computed styles on the row's clock element:

| State | opacity | transform | fill | ink | size | weight | animation |
|---|---|---|---|---|---|---|---|
| < 60s, motion, dark | 0.743 | `scale(0.972)` | `#FF5A5A` | `#0A0A0B` | 14px | 700 | `urgent 1s` |
| < 60s, reduced, dark | **1** | none | `#FF5A5A` | `#0A0A0B` | 14px | 700 | snapped |
| < 60s, motion, light | breathing | breathing | `#B42318` | `#FFFFFF` | 14px | 700 | `urgent 1s` |
| 60s–1h, dark | 1 | none | `#FF5A5A` | `#0A0A0B` | 14px | 700 | none |
| 1–24h, dark | 1 | none | none | `#F5F5F6` | 12px | 500 | none |
| > 48h, dark | 1 | none | none | `#9A9AA2` | 12px | 400 | none |

Reduced motion changes opacity and transform and nothing else. Fill, ink, size and weight all
survive, which is the property the `urgent` keyframe was written to have.

### Socket events

- **`bid`** — bidder A bid on lot 1 through the UI: WINNING, `Your auto bid: R119`, **and no
  alert** (the fix in defect 2). Bidder B then bid over the API: the row flipped to **OUTBID** live
  and showed `Another bidder just bid R 129`, which cleared itself after six seconds.
- **`lot_extended`** — a rival bid on spring-collectables lot 4 at 3:26 remaining (anti-snipe window
  300s). Response `extended: true, extension_count: 1`; the card's clock jumped to 04:58 and the
  alert read `Bid received — lot 4 extended by 2 min`.
- **`lot_rescheduled`** — `PATCH /admin/auctions/{id}` as the seeded admin. Every card in the
  auction showed `Closing time changed — lot N now closes 2 min later`, never the word "extended".
- **Own-bid absorption gotcha for the next person:** seeded bidders already hold proxies on most
  lots, so a "rival" bid at exactly `minimum_next_bid_minor` is absorbed by their own standing
  auto-bid — `accepted: true`, no new sequence, no event, nothing to see. Use a bidder with no
  `auto_bids` row on that lot (lots 3, 4 and 5 of spring-collectables are untouched by the seed).

### Sticky close bar

- Nothing inside the final hour: no sticky element, quiet line reads
  `29 lots · Closes Monday, 14 September at 19:37`.
- Lot 2 at 50 min: pinned, `NEXT LOT CLOSES · Lot 2 · 49:26 left`, with
  `A bid in that lot's last 5 min pushes its closing time out by 5 min, up to 20 times.` — the
  auction's real 300/300/20.
- Lot 3 then set sooner: the bar **renamed itself to lot 3**, which is the whole point of deriving
  it from the minimum open `effective_ends_at` rather than from the auction.

### The `unknown` bid state

`/me/bids` could not be saturated for real: the largest seeded bidder has 10 lots and the whole
database has 123, so 200 is unreachable. **Verified instead by lowering the client's own `LIMIT`
from 200 to 3**, which exercises the identical truncation path — rows rendered `BID STATUS UNKNOWN`
and the list's one-line notice appeared. `LIMIT` was restored to 200 afterwards.

### Both themes, and the anonymous list

Light and dark both driven end to end (light chosen the way a user chooses it — the stored
`cw.theme` preference — since dark is the default regardless of the OS setting). Every new pairing
was recomputed with the same WCAG relative-luminance harness and every one clears AA; the table is
in `CLAUDE.md`. The tightest new value is the extension alert's accent-text on its own tint over
surface, at 5.43 in light.

Anonymous: same list, **zero buttons in a row**, no bid state, no ⓘ, and the same quiet summary
line. `LotList` still takes `actions?` and absence is still the whole mechanism.

### Test data left behind

This run moved spring-collectables lot clocks around, placed a handful of bids on lots 1, 2 and 4,
and rescheduled the auction once. **The auction's `ends_at` and every lot's `scheduled_ends_at` /
`effective_ends_at` were restored to the seeded 7-minute stagger afterwards**, and extension counts
zeroed. The extra bids remain; `make seed-fresh` clears them.

# Lot search round (`/search`, cross-auction)

Client half only. `GET /api/v1/lots/search` had already landed on the backend; **no backend change
was needed or made**, and no new API field was asked for.

## What this round added

- `/search` — one input, results below, member-only. Reached from a search icon on the **auctions
  header**. **No fourth nav tab**: the nav is still Auctions / My bids / Profile.
- `lib/hooks/useLotSearch.ts` — the infinite query, the mirrored minimum, the opaque-cursor paging
  and the two-different-422s distinction.
- `lotSearchResultSchema` / `LotSearchResult`. **`LotSummary` was not widened** and `LotRow` was not
  forked — it is now exported and takes `auctionName`, `outcome` and a nullable `bidStatus`.

## Judgement calls this round

**Task 1 — bid state on biddable rows only, outcome on closed rows (option a).** The reasoning is
in `CLAUDE.md` under "Lot search"; the short version is that a biddable lot's auction has not ended,
so it is inside `/me/bids`' two-week window and the join is sound, while a closed one may not be —
and the unreliable case is then never asked. One refinement on top of the brief: **a `/me/bids` row
we actually hold is positive evidence in both directions**, so it is still used on a closed row, but
only in that direction — `amILeading` is passed when `statusFor` says `leading` (the pill becomes
"You won") and is never inferred from a row we may simply not have. `useMyBidStatus` needed no
change at all.

**Option (b) was rejected on what it costs the ordinary case**: a screen full of "BID STATUS
UNKNOWN" on any search for older sold items, which is exactly the search this endpoint exists to
serve. It answers a question nobody asked ("did I bid on this three-month-old lot") loudly, and
buries the one they did ask ("what did it go for").

**The query key is `["lots", "search", term]`, under the existing `lots` prefix.** `patchLot` walks
`["lots"]` and rewrites any cached lot page it finds, so a search row updates from a bid response
and from the socket with no new wiring. Verified by bidding from a search result — the row's price,
bid count, state line, auto-bid line and button figure all moved without a refetch of the search.

**Search opts out of the app-wide retry for 4xx.** The default (`failureCount < 2`) retried the 429
once, which spends the 60/min limiter again and pushes the user's own wait further out. Left as a
**local** opt-out rather than changing the global default, which would touch every query in the app;
worth raising separately, because retrying any 4xx is wrong everywhere.

**The minimum term length is mirrored client-side** — a duplicated server rule, allowed because it
is an input precondition rather than a filter over data and its drift direction is a loud 422. The
numeric exemption is mirrored with it, so a single digit is never blocked.

## Verification, driven against the running backend

`npm run lint`, `npm run typecheck` and `npm run build` all clean. Everything below was driven in a
real browser at 390×780 against `make dev-all` + `make seed`, signed in as `+27820000002`.

### Task 1 — the case the whole task exists for

`harvest-clearance-long-past` (20 days old, hidden from `GET /auctions`) is **found by search**: 8
rows, each reading **Sold** with no bid-state line and both buttons disabled. `summer-antiques-ended`
(3 days, inside the window) renders identically, and `Midweek Closing Sale lot 3` — a lot this
bidder actually bid on and lost — also reads **Sold**, claiming nothing false either way.

**Falsified by reverting it.** With `bidStatus={statusFor(lot.id)}` and no outcome, all eight harvest
rows rendered **NOT BIDDING**, and the truncation notice did *not* appear — `/me/bids` returns 8
rows for this bidder against a 200 cap, so `truncated` is false and `statusFor` answers `none` with
total confidence. That is the lie, reproduced, on lots whose bid rows exist server-side (`status:
won`) and which `/me/bids` omits purely because of the window. Reverted immediately afterwards.

Not driven: the **"You won"** pill. No seeded bidder has a closed lot they are leading — this
bidder's only closed row is one they lost — so the positive-evidence path was reasoned from
`lotOutcome`'s existing, already-shipped behaviour rather than seen. It is the one item on this list
that was not put in front of a browser.

### Cross-auction results and ordering

`q=7` (a **single digit**, not blocked by the mirrored minimum, one request) returns five rows in
five different auctions, each naming its own:

| # | Auction | Row |
|---|---|---|
| 1 | Spring Collectables | `Closes in 4d 23h` · OUTBID · `Your auto bid: R 51 332` |
| 2 | Autumn Fine Jewellery | `Closes in 6d 23h` · NOT BIDDING |
| 3 | Midweek Closing Sale | `Sold`, buttons disabled |
| 4 | Summer Antiques (ended) | `Sold`, buttons disabled |
| 5 | Harvest Clearance (long past) | `Sold`, buttons disabled |

Biddable first by soonest close, then closed by most recently ended — holding **across** auctions.
The buttons are gated by `isLotOpen` rather than by any auction-level flag: `biddingOpen` is simply
passed true on this screen, because search spans auctions and there is no single auction status to
read. Midweek Closing Sale is the case that proves it — the auction itself still reads `live` while
its lots have closed, and its rows disable correctly anyway.

### Paging

`q=lot` walked to the end on scroll: **6 requests, 101 rows, 101 unique — no repeats, no gaps.** An
independent walk of the same term straight against the API produced 6 pages and the same 101 ids.
Cursors went back verbatim (`cursor=eyJ0IjoiMjAyNi0wOS0wOVQx…`); nothing decodes one.

### Debounce and the `%` case

`harvest` typed at 60ms/char (7 characters) cost **one** request. A term below the minimum sent
**zero**. `lot 1%` returned a genuine **no match** rather than matching every `lot 1…` title, which
is what a `%` leaking into a `LIKE` would have done.

### Refusals

- **429, real.** Burned the 60/min limiter with the same user's token, then searched: one request,
  no retry, and *"Too many searches — Give it about 58 sec and try again."* from the actual
  `Retry-After: 58`.
- **422 on a malformed cursor**, forced by rewriting `cursor=not-a-cursor` on the way out: rendered
  as *"These results went stale"* with a **Start again** button — nothing on the input, no blame on
  the term — and the button dropped the walk back to page one (20 rows).
- **422 on the term**, forced by rewriting `q=a`: the server's own words (*"search term must be at
  least 2 characters"*) inline on the field with `aria-invalid`, and **nothing rendered below it**.
  The first attempt showed "No matches" underneath the field error, which is a second and different
  answer to the same refusal; fixed before this run.

### A bid from a search result

`Autumn Fine Jewellery lot 7`, pressed from the search row. One `POST /lots/{id}/bids`, and the row
went from `R 50 000 · no bids yet` / NOT BIDDING to `R 50 000 · 1 bid` / **WINNING** /
`Your auto bid: R 50 000`, with the Bid button's figure moving to `R 51 000` — all from `patchLot`
reaching the search cache plus the `/me/bids` invalidation.

### Liveness

Only biddable rows are subscribed, capped at the first 12 — the same number the auction screen
holds. **Nothing was needed for the 200-per-connection cap**: 12 from search plus 12 from an auction
screen cannot approach it, and a deep pagination walk adds no subscriptions at all.

### Both themes

Dark and light both driven end to end on `/search`. **No new tokens and no new colour pairings** —
the auction-name line is `--text-muted` on `--surface` (7.08 / 5.79) and the outcome pill is
`StatusPill`'s existing muted tone (5.95 / 5.44), both already in `CLAUDE.md`'s table. The focus ring
sits on the rounded wrapper, as `.field` intends.

### Test data left behind

One real bid of R 50 000 on `Autumn Fine Jewellery lot 7` by `+27820000002`, placed from the search
screen. `make seed-fresh` clears it. Nothing else was moved: no clocks changed, no auctions
rescheduled.

---

# Punch list from a live screenshot (lot pill, ended-auction bar, closed rows)

Five things spotted by looking at the running app on an ended auction. Four defects against what was
already agreed, one check.

## 1. The lot pill said `1`, not `LOT 1`

The word was only in an `sr-only` span, so the visible label was a bare number in a gold pill —
decoration, not something a person reads back down a phone line. Put in, in `LotList` and in
`AuctionCloseBar`, and the `sr-only` span removed with it (with the word visible it would have made
a screen reader say "Lot LOT 1").

**Measured for the widest realistic case** at 360×480 — `LOT 148` on the seed's longest title (249
characters, spring-collectables lot 2, temporarily renumbered):

| Row | pill | title | truncated | row height |
|---|---|---|---|---|
| `LOT 1`, long title | 54.2px | 148px | yes | **181px** |
| `LOT 148`, same title | 72.7px | 129px | yes | **181px** |

The pill costs no height at three digits; the title absorbs it exactly as `CLAUDE.md` says it
should. No type was shrunk and nothing wrapped.

## 2. The sticky close bar rendered on an **ended** auction — a guard gap

The header showed `Ended` and, directly under it, `NEXT LOT CLOSES · LOT 11 · 04:22 left`.

**Which of the two it was, established rather than assumed.** The backend cannot produce that state:
`end_finished_auctions` marks an auction ended only *once its last lot has* ("An auction ends when
its last lot has"), and `cancel_auction` cancels the still-open lots along with the auction. A clean
`make seed-fresh` confirms it — no ended auction has a live lot. So the *data* came from the
previous session's manual SQL, which is the artefact option in the punch list.

**But the guard is still missing, and the client can reach the same state on clean data.** The
auction and lots queries refresh independently, and only the first `SUBSCRIBE_AHEAD` (12) lots get
`lot_closed` over the socket, so a freshly `ended` auction sitting beside a stale page of `live`
lots is an ordinary few seconds. It is worth noting the seed *does* stagger lot clocks well past the
auction's own `ends_at` — `midweek-closing-soon` ends at 20:02 with its last lot at 22:15 — so the
skew window is not theoretical.

Reproduced deliberately (auction forced to `ended`, lots left live and future) and tested both ways:

- guard removed: `Ended` badge above `NEXT LOT CLOSES · LOT 11 · 02:23 left`, on a lot whose bid
  buttons were already disabled — exactly the screenshot.
- guard in place: no sticky element, quiet line reads `24 lots · Closed`.

`AuctionCloseBar` now requires `auction.status === "live"` for the alarm branch. The per-lot filter
is still `isLotOpen`; this is an auction-level question, not a "can I bid" one.

## 3. A closed lot showed both "Bidding closed" and "NOT BIDDING"

Two lines saying nearly the same nothing. `LotList` now does what `SearchScreen` already did: a
closed row passes `bidStatus={null}` and an `outcome` from `lotOutcome`, so the clock slot carries
the lot's own result and the bid-state line stands down. `amILeading` is read from a `/me/bids` row
we actually hold — positive evidence only, so `You won` is never inferred from a row we may not
have, and `NOT BIDDING` is never asserted where the app cannot tell.

Verified on lots the worker genuinely closed (`ended_unsold`, `ended_sold`) rather than on forced
statuses: closed rows read `No bids` / `Sold` / `You won` on one line and nothing underneath.

**Row height on a closed row is 183px against an open row's 181px** — `StatusPill` is 26px against
the clock line's `min-h-6` of 24px. Left as is: the 2px lands only on a row that has already closed
and whose buttons are already disabled, whereas raising the reservation would grow every open row.

## 4. `BID  R 174` had a double gap

The button's contents were a bare text node beside `Money`, so the text node became its own flex
item and picked up `Button`'s `gap-2` *on top of* the ordinary space. Wrapped in one `<span>`, so
there is a single space and the label reads as one thing. **`formatMoney` was not touched** — the
space inside `R 174` is Intl en-ZA currency formatting and is the same everywhere money appears.

## 5. Lot 3's image — the seed, no change

`SEED.md` line 15: *"Lot with no images (card must not break) | every auction's lot 3."* The API
returns `primary_image_url: null` for lot 3 and a resolving URL for every other lot (spot-checked:
`200 image/png` from the MinIO host). What renders is `LotImage`'s own deliberate placeholder — a
gradient panel with a picture-frame icon, `role="img"` and an accessible name of `"<title> — no
photo"` — not the browser's broken-image glyph. It is the fixture doing its job. Nothing changed.

## Verification

`npm run lint`, `npm run typecheck`, `npm run build` all clean. Driven against `make dev-all` +
`make seed-fresh` at 360×480 in both themes, with no page errors. Final pass on untouched seed data:
live auction `29 lots · Closes Monday, 14 September at 22:08`, no sticky bar, rows at 181px reading
`LOT 1` / `BID R 99`; ended auction badged `Ended` with `24 lots · Closed`, no sticky bar, and rows
reading `No bids` on one line.

### Test data left behind

The measurement renumbered a lot to 148 and force-closed several lots. **`make seed-fresh` was run
afterwards**, so the database is back to the documented dataset.

---

# One retry rule, and releasing a failed bid's own-bid claim

Two fixes before commit, both about a rule that had been discovered locally instead of centrally.

## 1. One retry predicate, app-wide

Three existed: `app/providers.tsx` (skip `SessionExpiredError`, retry everything else twice),
`usePublicAuction`'s `retryUnlessGone` (adds 404, three call sites) and `useLotSearch`'s (adds all
4xx and `SearchCursorError`). The same rule, rediscovered twice, for different status codes.

It now lives in the default and both local predicates are deleted. **React Query's query-level
`retry` overrides the default wholesale rather than composing with it**, which is exactly why a
local predicate is a second copy of the reasoning rather than an addition to it — worth stating,
because it is the reason the pattern kept recurring.

**`SearchCursorError` had to survive, but not as a retry concern.** It is what `SearchScreen`
branches on to offer "start again" instead of blaming the term, so the class stays. But it extended
bare `Error` and therefore carried no status, so a blanket 4xx rule could not see it. It now extends
`ApiError` with the 422 it wraps — which it *is*, only a differently-meaning one — and the local
predicate goes entirely.

One consequence, caught by reading rather than by the type-checker: `SearchScreen` derived
`termRefused` from `apiError?.status === 422`, so once the cursor error carried a 422 it would have
marked the search *field* invalid on a stale cursor. The comment there already said "a 422 **without
a cursor** is the term itself"; that now has to be said in the condition rather than inferred from
the status.

### A correction to the brief, measured rather than assumed

The instruction was to write into the comment that on a 429 "the retry is actively harmful, not
merely wasteful — it spends the limiter again and pushes the user's own `Retry-After` further out".
**That is not true of this backend, and the comment says what is.**

Every limiter in the API goes through one helper whose docstring is explicit: *"INCR then EXPIRE
only on first write, so the window is fixed rather than sliding."* Extra requests inside the window
increment a counter whose TTL is already set, so they cannot lengthen the wait. Verified against the
running API rather than by reading it — burn the search limiter, then make two retry-shaped
requests:

```
first 429 after 60 requests    -> Retry-After: 60s
after 2 retry-shaped requests  -> Retry-After: 60s, 60s
=> the wait did NOT grow: fixed window
```

What is true, and what the comment now argues, is stronger in one way and weaker in another: a retry
on a 429 here **cannot succeed by construction** — the window is 60s and the backoff is ~1s then
~2s, so both retries land inside the same window — costing three requests, two backoff delays and a
later answer for the user. It would be *actively* harmful against a sliding window, and that is
recorded as the reason not to relax the rule for 429 later.

**408 is noted as considered rather than overlooked.** It is the one 4xx that plausibly self-heals;
this API never emits one (FastAPI has no path that returns it, and Caddy answers a timed-out
upstream with 504, a 5xx, which is retried), so a blanket rule is right *here* and would not be in
front of an API that does emit 408.

### Verified

- **A real 429 on search makes exactly one request.** The caller's own limiter was burned from the
  API side (60 searches), then one search typed in the browser: `1` request,
  `/lots/search?q=chair&limit=20`, and the screen read *"Too many searches — give it about 26 sec
  and try again."*
- **A 404 auction still costs one attempt per query.** A draft (private) auction opened anonymously
  made two requests — the auction and its lots — one attempt each, not retries, which is what
  `retryUnlessGone` used to guarantee.
- Search's ordinary paths still work: `"Cape"` → 1 row, 1 request; a one-character term is refused
  by the client and sends nothing at all.

## 2. Release `expectOwnBid` when the bid fails

`useBidSubmit` claims the lot *before* the request, because the socket echo of a bid usually beats
its own HTTP response back, and `applyBidResult` clears the claim by naming the exact sequences that
were ours. **A refusal produces no result, so it cleared nothing** and the claim stood for the full
`OWN_BID_WINDOW_MS` — during which a rival's genuine bid on that lot was read as the caller's own
echo and silently swallowed. Worst on the row the user has just been told they are *not* winning.

The claim is a prediction that a bid is about to appear on that channel; a refusal is evidence the
prediction is false, and holding a known-false prediction is strictly worse than dropping it. The
success path already clears on evidence; the failure path had evidence and threw it away.

**Narrower than "every path that produced no bid", deliberately.** Only a 4xx is that evidence. A
5xx, a dropped connection or a `ResponseShapeError` all leave open that the bid *did* commit and its
echo is still coming — and for `ResponseShapeError` it certainly did. Releasing there would
reintroduce the exact failure the claim exists to prevent (announcing the caller's own bid back to
them as somebody else's), whereas holding it costs one suppressed rival alert, which is the
trade-off already documented. So the release is `cause instanceof ApiError && status 400–499`.

### Verified, both directions

Lot 2 of spring-collectables, where the caller already holds a bid. The price was raised with direct
SQL — **no socket event fires for a SQL write**, so the client keeps a stale
`minimum_next_bid_minor` and its BID button is genuinely refused:

```
refusal at +1971ms: "Someone bid first — the minimum is now R 51 000."   (real 422)
rival bid at +3297ms -> 200, seq 2                                       (inside the 10s window)
lot 2 at +5802ms: ... "Another bidder just bid R 510"                    => ALERT SHOWN
```

With the release removed and the same script re-run on the same data:

```
refusal at +1990ms: "Someone bid first ..."
rival bid at +3244ms -> 200, seq 2
lot 2 at +5773ms: (no alert)                                             => ALERT SWALLOWED
```

`npm run lint`, `npm run typecheck` and `npm run build` clean; no page errors in any run.

### Test data left behind

Lot 2's `current_bid_minor` and the rival's bids were restored to the seeded values after each run.
The search and bid rate-limit counters were cleared with `make reset-limits`.

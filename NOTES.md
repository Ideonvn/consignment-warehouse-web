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

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
- **Auction cards are enterable when live or ended, not when scheduled.** Ended auctions still let
  people look at what things went for; a scheduled auction shows a countdown to opening instead.
- **The stack subscribes to the visible cards plus the next few (8), not the whole page.** My Bids
  subscribes to every open lot the user has money on — far below the 200-lot cap either way.
- **Lot pages have static metadata.** Per-lot titles would need a server-side fetch, but the access
  token is deliberately memory-only in the browser, so the server cannot authenticate. Titles are
  set client-side by the shell instead.

## Backend requests

- **`GET /me/swipes` (or a `direction` filter on a global lots endpoint).** Swipes are only
  queryable per auction, so the "Interested" and "Passed" views fan out across every visible
  auction and merge client-side (`lib/hooks/useSwipedLots.ts`). One call would replace N.
- **`status` is not authoritative for "can I bid" in the gap before the worker ticks.** Between
  `effective_ends_at` passing and the lifecycle worker publishing `lot_closed`, the lot still reads
  `status: "live"` over REST while any bid is refused with a 409. The gap is short (seconds), but
  the client closes itself off the clock rather than waiting — see `isLotOpen`. Documenting the
  gap would save the next client author the same discovery.
- **`subscribe` takes one `after_sequence` for the whole batch.** A screen resubscribing to several
  lots at once holds a different sequence per lot, so a single resume point cannot be right for all
  of them: the lowest replays events some lots already have, the highest skips events others still
  need. The client sends the lowest (duplicates are recoverable, gaps are not) and drops replays it
  has already applied. A per-lot map — `{"lot_id": sequence}` — would make this exact.
- **Frozen-field error shape is undocumented.** Observed in the wild as
  `{"detail": {"message": "...", "field": "effective_ends_at"}}` — a single `field` string.
  `lib/api/errors.ts` handles that plus plural `fields`/`frozen_fields` variants.
- **`lot_rescheduled` payload is abbreviated** in the spec (`{"type":"lot_rescheduled","lot_id",...}`),
  so it is parsed as `lot_id` plus optional `effective_ends_at`/`status`.
- **No lot count on the auction object.** The auction list shows name, image, status and countdown
  but not "12 lots", because it isn't derivable without paging every lot of every auction.
- **CORS with credentials is required.** The client sends `credentials: "include"` on every call so
  the HttpOnly refresh cookie flows; the backend must keep `Access-Control-Allow-Credentials: true`
  with a non-wildcard origin. (It does today.)

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
- **Auction lot counts** — not derivable from the API; see the backend request above.
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

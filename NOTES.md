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
- **Lots stay `status: "live"` after `effective_ends_at` passes.** A bid then fails with 409 while
  every list still reports the lot as live. Clients have to derive closure from the clock. Either
  a closer that flips status promptly, or documenting that `status` is not authoritative for
  "can I bid", would help.
- **No `lot_closed` event was observed when a lot's clock ran out** (verified by moving a lot's
  `effective_ends_at` to 50 seconds out via the admin API and watching a subscribed client). The
  handler is implemented and the UI now closes itself off the clock, but the event never arrived.
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

## Deferred

- **Per-lot `<title>`/OG metadata** — needs authenticated server rendering, which conflicts with
  the memory-only access token. See the judgement call above.
- **Auction lot counts** — not derivable from the API; see the backend request above.
- **Bid history live-splicing.** A `bid` event invalidates the paginated history and lets it
  refetch, rather than splicing the new bid into page one. Simpler and always correct; costs one
  small request per bid on the lot detail screen only.
- **Image optimization** — off until the media host is settled.

## M10 journey result

Walked end to end against the running backend (`localhost:8000`, seeded data) in a 390×844
viewport, signed in as `+27820000004`, with `+27820000002` as the rival bidder and
`+27820000001` (admin) used only to move one lot's closing time forward.

| Step | Result |
|---|---|
| Log in with `0000` | Pass. OTP auto-submits on the 4th digit; new session lands on the intended destination (`?next=` preserved through the whole flow). |
| Session survives reload | Pass. Access token is memory-only; the HttpOnly cookie drives a single refresh, then `GET /auth/me`. |
| Browse auctions | Pass. "Spring Collectables" listed live-first with a live pill and closing countdown. |
| Enter the stack | Pass. Three cards deep, unswiped lots only, ordered by lot number. |
| Swipe left (drag) | Pass. Card tracks the pointer 1:1 with proportional rotation, "Pass" intent fades in, flies out left, `PUT /swipe {pass}` recorded. |
| Swipe right (drag) | Pass. Records `interested` **and** opens the confirm sheet; the lot leaves the stack whether or not a bid follows. |
| Confirm a bid | Pass. Sent `amount_minor = minimum_next_bid_minor`, `max_amount_minor = their number`. Result: "You're winning at R450." |
| See it in My Bids | Pass. Grouped Winning / Outbid / Ended, with the user's own maximum on each row. |
| Open lot detail | Pass. Gallery, price, minimum next bid, reserve marker, own maximum, bid history with own bids marked and auto-bids labelled. |
| Raise the maximum | Pass. R450 → R900 via `PUT /auto-bid`. Price stayed at R450, as designed — raising while leading moves nothing and tells nobody. |
| Rival bids higher | Pass. `+27820000002` bid from a separate session. |
| First window updates live | Pass. Over the websocket: price R450 → R950, bid count, new minimum, `am_i_leading` flipped, price pulsed, and an "You've been outbid" toast with a one-tap raise. |
| Let a lot close | **Partial.** The countdown reached zero and the screen switched to "Bidding closed" — but off the clock, not off a `lot_closed` event, which never arrived (see backend requests). The lot also still reports `status: "live"` over REST while rejecting bids with 409. |
| Ended lot renders correctly | Pass, with the caveat above: pill reads "Bidding closed", the CTA is disabled, and the bid sheet refuses to open a form. |

Also verified during the walk: keyboard-only operation of the stack (Tab reaches it, ←/→ pass and
bid, Escape closes the sheet and restores focus to the stack), un-passing from the Passed view
returns the card to the front of the stack, and the palette against WCAG AA — every foreground /
background pair in the design system scores 5.4:1 or better, the lowest being danger-on-raised.

### Bugs found and fixed during verification

1. **Swipes did nothing.** The card's `<img>` started a native HTML5 drag, which swallowed the
   pointer stream framer-motion needs. Fixed in `LotImage` (`draggable={false}` + `select-none`) so
   every gesture surface benefits, not just the stack.
2. **Cards were pinned in place.** `dragConstraints={{left: 0, right: 0}}` clamps a card to its
   origin; removed in favour of free drag with `dragSnapToOrigin`, which is also what "follows the
   finger 1:1" actually requires.
3. **The outbid check read stale data.** `fetchQuery` honours `staleTime`, and the socket handler
   had just written to that cache entry, so the refetch that decides "am I still leading" was
   served from cache. Fixed with `staleTime: 0` on that one call.
4. **Dead lots invited bids.** See `isLotOpen` above.

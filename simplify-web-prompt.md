# Simplification: bidder web app

Read `CLAUDE.md`, `AGENTS.md` and `NOTES.md` first, then **read this whole file before
writing anything.** Do not create a git commit.

**Run this after the backend prompt has landed.** It can run in parallel with the admin
prompt.

## Context, and what it means for this file

The first live stakeholder session found this app too complex. The direction is now:
**fewest buttons, fewest options, fewest taps to place a bid.** Several original product
assumptions were wrong and are being reversed.

That means **`CLAUDE.md` in this repo is substantially wrong after this change**, not
merely out of date. Whole sections describe a product that will no longer exist. You are
expected to rewrite them — and where a rule is being reversed, **say what it was and why it
no longer holds** rather than deleting it. A reversal with no trace reads as an oversight
to whoever finds it next.

Nothing is live and nobody is using the app. Delete freely. Do not leave dead components,
unused hooks or dormant code paths behind "in case" — if it is not reachable, remove it.

## Task 1 — one layout: the list

**Delete the card stack and the gallery.** The list is the only way to browse an auction.

Remove:

- `CardStack.tsx`, `GalleryLayout.tsx` and everything that exists only to serve them
- the layout preference (`lib/browse/layoutPreference.ts`), the profile switcher
  (`LayoutSetting.tsx`), the first-run chooser and its previews
- the `?at=<lot_number>` anchor and the "open the stack at this lot" ordering
- `--stack-actions-h`, `touch-none`, the fixed action row and everything in the layout
  tokens that existed only for the stack

`components/lot/LotGallery.tsx` is **not** the gallery layout — it is the lot-detail image
viewer and it stays. Check before deleting anything with "gallery" in the name; that file
has already been overwritten once by mistake.

## Task 2 — remove swiping entirely

The backend has dropped `lot_swipes`, `PUT/DELETE /swipe`, `GET /me/swipes` and `my_swipe`.
Passing and "interested" are gone from the product.

Remove the client side of all of it: the four gestures, undo, skip, the browse-session
history (`lib/browse/browseSession.ts`), the swiped-lots list, and the "same set in every
layout" filtering. **Lots stay in the list until they end.** Nothing is removed from view as
a consequence of what the user did.

**And remove the pending-bid cancel window** — `lib/bid/pendingBid.ts`,
`PendingBidStrip.tsx`, `PendingBidRunner.tsx` and the five-second delay. A bid is placed the
moment the button is pressed.

You are removing a documented safety property. **Record that honestly in `CLAUDE.md`**: the
window existed because there is no bid retraction API and a mis-tap was therefore
irreversible; it was removed because stakeholders found the delay confusing and wanted the
bid immediate. That is a deliberate trade, and the next person should find the reasoning
rather than re-deriving it.

## Task 3 — the list row, which is now the whole product

Two buttons per row and nothing else. **No pass.**

| Position | Label | Behaviour |
|---|---|---|
| Left | **Enter Maximum** / **Raise Maximum** | opens the existing slide-up sheet with an editable amount |
| Right | **Bid R1 200** | places that bid immediately, no sheet, no confirmation |

- The right button **shows the actual amount** — `minimum_next_bid_minor`, rendered through
  `Money.tsx`. Never compute it; it is server-owned and price-banded.
- Pressing it places a bid at exactly that amount, with **no maximum**.
- The left button's label depends on whether the caller already has an auto-bid on that lot.
  The backend now puts `my_auto_bid_max_minor` on `LotCardOut` for exactly this.
- **Remove the increment chips** below the amount input in the sheet. Stakeholders found
  them noisy. The sheet keeps one editable field: the most you will pay.

The sheet still sends `amount_minor` = the server's `minimum_next_bid_minor` and the user's
typed number as `max_amount_minor`. Sending their number as `amount_minor` would make their
ceiling the visible price and overpay instantly. Raising an existing maximum still goes to
`PUT /auto-bid` and is still raise-only.

**`am_i_leading: false` on a successful bid is still not an error** — a rival's hidden
maximum was higher and the backend counter-bid instantly. Say so plainly and offer to raise.

Every refusal path still needs handling, and now has nowhere to hide since there is no
confirmation step: the deposit-shortfall 403 with `shortfall_minor` rendered from the server
and never computed, the 409 for a closed lot, the 422 when someone bid first, and the 429
with a wait derived from `Retry-After`.

## Task 4 — the lot number, made obvious

Testers could not find it. On each list row, put the lot number **top-right, noticeably
larger**, in the space that is currently empty. It is how people refer to lots out loud and
in messages, so it should be the second thing you see after the photograph.

Do not enlarge the row to fit it.

## Task 5 — the countdown, made urgent

A live lot's clock must be unmissable. It already turns red in the final minute; make that
harder to ignore.

Propose and implement something stronger — size, weight, a background rather than just
coloured text, movement. Constraints:

- **Under `prefers-reduced-motion`, drop the animation and keep the urgency.** `CLAUDE.md`
  records the previous version of this mistake, where the drag hints hid themselves entirely
  under reduced motion and removed the only signal of what a gesture would do. Colour alone
  must never be the signal either.
- Anchored to server time via `useNow()`. Never `Date.now()` during render.
- It must not push the buttons off a 360×480 screen.

Say what you chose and why.

## Task 6 — images are never cropped on lot detail, and can be opened full screen

**On lot detail, never crop.** Letterbox: fit the whole image, fill the rest with black.
A landscape photo from a phone must show its full width. The list rows keep their current
crop — a ragged list is worse than a cropped thumbnail, and the detail page is where someone
examines the item.

**Tapping an image opens it full screen, with pinch-to-zoom.** `LotGallery.tsx` is the
existing viewer; extend it rather than building a second one.

**Try the platform before reaching for a library.** A full-screen image in a container with
appropriate `touch-action` gets pinch-zoom from the browser for free on both iOS and
Android. If that genuinely does not work, say precisely what failed before proposing a
dependency — this repo has no component library by policy and one gesture is a poor reason
to start.

A lot may now have up to 20 photos, so the viewer needs to page between them and say where
you are in the set.

## Task 7 — the palette

Move from the current lime accent to the logo's gold.

**The brand gold is `#F6C000`**, sampled from the logo artwork rather than estimated — the
dominant cluster is `#F6BA00`/`#F6C000`/`#F6C600`, so that is a confident read. Black
(`#0A0A0A`) and white in the logo already match the existing `--bg` and text tokens, and the
logo's red (`~#AE0000`) is close enough to the existing `--danger` that nothing needs to
change there.

This is not a find-and-replace. `CLAUDE.md` documents why the accent needed three tokens:
`#E8FF5A` is ~1.1:1 against white, so `--accent` (fills), `--accent-text` (text and thin
marks) and `--accent-edge` (a border on a brand fill in light mode) all exist and diverge
between themes. **Gold has the same problem** — it is 1.69:1 against white, better than the
lime but still under the 3:1 a non-text boundary needs.

**A starting point, already measured. Verify each of these yourself rather than trusting the
table, then use it or beat it:**

| Token | Dark | Light | Measured |
|---|---|---|---|
| `--accent` (fills) | `#F6C000` | `#F6C000` | 11.74:1 on dark bg; 1.69:1 on white → needs the edge |
| `--accent-ink` (label on the fill) | `#0A0A0B` | `#0A0A0B` | 11.74:1 on the gold — works in both themes |
| `--accent-text` (gold as text, thin marks) | `#F6C000` | `#806200` | 11.74:1 on dark; 5.73:1 on white; 5.35:1 on the `accent/10` tint |
| `--accent-edge` (border on a gold fill) | `transparent` | `#806200` | 3.4:1 against the gold fill, 5.73:1 against white |

The gold stays gold in both themes, exactly as the lime did — it is the brand colour and
must not be darkened into something else in light mode. Only the *text* and *edge* variants
diverge.

Then:

- Rework any tint derived from the accent, in **both** themes.
- **Re-measure every pairing in the contrast table** in `CLAUDE.md` and update the numbers,
  including the ones the accent does not touch, since you are editing that table anyway.
  4.5:1 for body text, 3:1 for large text and non-text boundaries. Do not eyeball it —
  that file records two occasions where eyeballing shipped something failing.
- Green currently means *winning* (`--success`) and is used for outcomes. **Do not repaint
  it gold**, or winning and branding become the same colour and neither reads. Only the
  accent moves. Say what you concluded about anything green that is not `--success`.
- Black stays. Photographs are the content and they read against black.

## Task 8 — what the backend changed under you

- `my_swipe` is gone from every shape.
- `my_auto_bid_max_minor` is now on `LotCardOut`.
- `GET /auctions` and `GET /me/bids` exclude anything whose auction ended more than two
  weeks ago. **This is server-side; do not filter again in the client.** A second copy of
  the rule is a second thing to keep in step.
- Lots may have up to 20 images.

Regenerate or update the zod schemas at the boundary. `types/api.ts` is `z.infer` over them,
so change the schema, not the type.

## Verification

- `npm run lint`, `npm run typecheck`, `npm run build` — the React Compiler rules are errors.
- **Drive it against the running backend.** `make dev-all` and `make seed`. Every bug worth
  finding in this app was found that way, not by reasoning about it.
- Place a bid from the list and confirm one `POST /bids` fires immediately, with the amount
  on the button, and no confirmation step.
- Set a maximum, then confirm the left button reads "Raise Maximum" on that row afterwards.
- Each refusal path with a real cause: a bidder with no deposit, a lot past its
  `effective_ends_at`, and a real 429 from the limiter.
- Watch a lot cross into its final minute and confirm the countdown change, with and without
  `prefers-reduced-motion`.
- A wide landscape and a tall portrait photo on lot detail: both whole, black bands, and
  pinch-zoom working **on a real phone**, not a desktop emulator — touch gestures are the
  one thing a devtools emulator reliably lies about.
- 360×480 on a scheduled auction, which is the tightest height case.
- Both themes, with the new palette, and paste the measured ratios.
- A grep proving no swipe, layout-preference, gallery-layout, card-stack or pending-bid code
  survives.

## Ground rules

- **Do not create a git commit.**
- No new dependencies. If pinch-zoom genuinely cannot be done with the platform, say so and
  stop rather than adding one.
- **Never compute `minimum_next_bid_minor`**, and never render a reserve amount.
- Money is minor units, divided by 100 exactly once, in `Money.tsx`.
- Gate on the clock, not `status`.
- Delete rather than deprecate. Nothing is live.
- If anything conflicts with `CLAUDE.md` beyond the reversals named here, tell me rather
  than choosing.

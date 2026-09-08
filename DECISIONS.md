# Simplification: decisions and why

Running log for `simplify-web-prompt.md`. Every judgement call I made without asking,
in the order I made it. Read this first.

## Ground truth I established before writing anything

- Backend running from `/Users/ideon/src/consignment_warehouse` (`make dev-all`, `make seed`),
  and I read `/openapi.json` rather than the prompt's summary. Confirmed there:
  `PUT/DELETE /lots/{id}/swipe` and `GET /me/swipes` are **gone from the route table**;
  `my_swipe` is gone from `LotCardOut`, `LotDetailOut` and `MyBidLotOut`;
  `my_auto_bid_max_minor` is on `LotCardOut` **and** `LotDetailOut`; `LotCardOut` still
  carries `bid_sequence` (the public card shape does not, and never did).

## Task 1 — one layout

1. **`skip` (the up gesture) was deleted here, not in Task 2.** The prompt lists it under
   Task 2, but skip existed only to re-order `cards` — the stack's rotation of the lot set.
   Once `cards` went with the stack, `skip` pushed an entry into a history nothing read.
   Leaving it until Task 2 would have meant one gate run with provably dead code in it.

2. **`useAuctionBrowse` survives, much thinner, rather than folding into the screen.**
   It is the member counterpart to `usePublicAuction`, and keeping the pair symmetrical is
   what lets `LotList` take either without knowing which. Folding it in would have saved a
   file and cost that symmetry.

3. **`MyBidsScreen` lost its tab bar entirely.** "Interested" and "Passed" were swipe views.
   One remaining tab is not a choice, so `BiddingList` is now the screen. Its route dropped
   the `Suspense` boundary with it — that existed only for the `?view=` search param.

4. **`--on-fill` was kept and repurposed, not deleted.** It existed for the swipe hints, but
   it encodes something still true and still needed: the ink on a filled mark inverts between
   themes. Task 5's countdown fill needs exactly that. Reuse, not dormant code — it has a live
   consumer. `--undo` had no such second use and is gone.

5. **`app-width`, `--nav-h` stay; `--stack-actions-h` is gone.** The first two are the phone
   column and the bottom nav, neither of which was stack-only. `touch-none` had no occurrences
   left outside a comment.

## Task 2 — no swiping, no cancel window

6. **The list row rebuild (Task 3) landed in the same wave as Task 2.** Task 2 deletes pass and
   interested — which *are* the row's two buttons — and Task 3 defines what replaces them.
   Running a gate in between would have meant committing a row with no buttons at all, which is
   the broken intermediate state I was asked to avoid. Gates ran clean on the combined change.

7. **`useLotActions` was rewritten rather than deleted.** What is left of it is real: one path
   to `POST /bids` and one to the sheet, plus the in-flight set that stops a double tap becoming
   two bids. That double-tap guard used to be the cancel window's idempotency key; with the
   window gone it has to live somewhere, and a per-lot in-flight set is the smaller answer.

8. **The outcome sheet moved from `PendingBidRunner` to the screen.** `BidOutcomeSheet` itself is
   unchanged in structure and kept — it was never the confirmation, it is the *outcome*, and the
   prompt is explicit that every refusal path still needs handling and now has nowhere to hide.
   Only its copy changed, which referenced the five-second window and "your stack".

9. **`bidNow` gates on the clock, not `status`,** and refuses with a toast rather than firing a
   request it knows the server will 409. Same rule as before; the difference is that there is no
   longer a five-second window in which the clock could run out mid-wait.

10. **`my_auto_bid_max_minor` is read structurally in `LotList`, not by widening `LotSummary`.**
    `LotSummary` is the shape *both* the member and public cards satisfy, and the public card has
    no such field. Widening it would have broken the boundary that stops a public row rendering a
    member affordance. One cast, at one site, with the reason written next to it.

11. **The 320ms row hold is gone.** It guarded against a row vanishing under a finger and dropping
    the next row's Pass button into the same pixels. Nothing vanishes now and there is no Pass, so
    the hazard it protected against no longer exists. This is a deleted safety property whose
    threat model was deleted first — unlike the cancel window, which is a real trade (below).

## Task 3 — the list row

12. **The badge stayed; only buttons were restricted to two.** "Two buttons per row and nothing else"
    reads as a rule about *controls*. The Winning/Outbid/unknown badge is not a control, and it is
    the documented `/me/bids` join with its own "never assert no-bid when truncated" rule. Removing
    it would have deleted a correctness property nobody asked me to delete. It moved onto the clock
    line to keep the top line free for the lot number.

13. **A plain bid makes the row read "Raise Maximum".** Verified live: the backend sets
    `my_max_minor` to the bid when no maximum is sent, so the field the label reads is non-null
    immediately afterwards. I left this as-is — the user's ceiling genuinely is that amount, and
    raising is genuinely the next action — and recorded it as a known gap rather than special-casing
    the label against the bid amount, which would be the client second-guessing the server's model.

14. **Both buttons disable together.** Not in the prompt. But letting "Enter Maximum" open on a lot
    the clock has closed just moves the refusal to the end of a form, and the sheet already has a
    closed state for the race. One condition, both buttons.

## Task 4 — the lot number

15. **It went on the title's line, not on a line of its own.** "Do not enlarge the row to fit it" is
    the binding constraint; the title row already had unused space on the right and the title
    truncates, so the number costs zero height. **I made it full-strength `text-text`, not muted** —
    first attempt was `text-text-muted` and the screenshot showed it reading as secondary, which is
    the exact failure being fixed. `sr-only "Lot "` keeps it meaningful to a screen reader.

## Task 5 — the countdown

16. **Fill + weight + size + motion, and `plain` to opt out.** Colour is one of four signals, so a
    bidder who cannot distinguish red still sees it. The `urgent` keyframe puts full strength at
    *both* 0% and 100% specifically so the existing global reduce rule — which snaps animations to
    their final frame — lands on the emphatic state. That is why reduced motion needed no new CSS.

17. **The alarm replaces the "live" `StatusPill` on lot detail rather than nesting inside it.** An
    accent-bordered pill wrapped around a danger fill reads as neither.

18. **Auction-level clocks take `plain`.** An auction's own close, "opens in", and the anti-snipe
    extension notice are not a lot's bidding deadline; alarming on them is crying wolf.

19. **`min-h-6` on the clock line.** Without it, crossing into the final minute grows the row and
    pushes the buttons down — the exact thing the 360×480 constraint forbids. Measured: 167px both
    sides of a real crossing.

## Task 6 — images

20. **Letterbox is `object-contain` plus a black ground on the container**, and `twMerge` lets the
    `object-contain` at the call site override `LotImage`'s default `object-cover` — so `LotImage`
    keeps one default and the two call sites differ by one class.

21. **Pinch-zoom is the platform's.** `touch-action: pan-x pinch-zoom` on the full-screen track;
    no library, no gesture code. `pan-y` is deliberately omitted so a vertical drag cannot scroll
    the page behind the overlay. This depends on the document allowing user scaling, which it
    already did (`maximumScale: 5`, no `userScalable: false`) — I changed nothing there and flagged
    it in `CLAUDE.md` as the first thing to check if zoom ever breaks.

22. **"3 / 20", not dots.** Dots do not scale to 20 and cannot be counted. The count is also in a
    live region, because a scroll-snap change is silent to a screen reader.

## Task 7 — the palette

23. **I re-derived every number and did not trust the table.** The prompt's proposed values all
    reproduce exactly (11.74, 1.69, 5.73, 3.40) except the light tint, where I measure 5.43 against
    the stated 5.35 — a difference of compositing over white vs the page background; both clear.

24. **I found a wrong number already in `CLAUDE.md`.** Light `success` was recorded as 6.7/7.3/6.3;
    the shipped `#146b33` actually measures 6.01/6.60/5.69. The recorded figures match ~`#146333` —
    a one-digit transposition. Nothing shipped failing, but the file's own warning about eyeballing
    now has a third instance. I cross-checked my harness against every other row of the old table
    first, including the 4.38 failure it records, and reproduced all of them — so the harness is
    calibrated, not just self-consistent.

25. **The tightest pairing in the new palette is 4.69** (light `accent-text` on an `accent/10` tint
    over `--surface-raised`, which is what `PhoneField` paints). It passes 4.5, but it is the value
    that will break first if anyone lightens `--accent-text`, so it is now in the table by name.

26. **Green was audited, not assumed.** Every green resolves to `--success`. The one arguable case is
    `AccountScreen` using `text-success` for a *credit* ledger line — money in, not a lot won. Left
    green: it is the same "good thing happened" family, and a fourth semantic colour to separate
    them would cost more than the overlap. Nothing green became gold.

27. **The app icon was repainted.** `app/icon.svg` had the lime hard-coded. Moving the accent and
    leaving the installed-app icon lime would be the most visible possible miss.

## Task 8 — the backend's changes

28. **`my_auto_bid_max_minor` moved from `lotDetailSchema` up to `lotCardSchema`**, matching the real
    `LotCardOut`. `lotDetailSchema` extends the card schema, so it inherits it and the detail screen
    needed no change.

29. **No client-side two-week filter was added**, and `listAuctions`/`listMyBids` now carry a comment
    saying why. Verified live: the long-past auction is simply absent from `/auctions`.

## Things I changed that no task asked for

30. **"Enter stack →" and the bottom-nav tab "Stack".** Grep for `CardStack` found neither — they
    are prose. Driving the app found them in the first minute. Now "Browse lots →" and "Auctions".

31. **Three pieces of stale copy**: "keep browsing and swiping", "Swipe right on a lot you want",
    "Swipe through the lots. Right to bid, left to pass", plus the manifest and `<meta>` description
    "Swipe, bid and win". A grep for `swipe` missed "swiping"; the 403 panel surfaced it.

32. **The 409 copy asserted the wrong cause.** It said the clock ran out; my 409 test was an admin
    withdrawal, which is also a 409. Now it states what is certain — no bid, no charge.

33. **The `aria-label` on the Bid button.** My first version divided by 100 inline, which breaks the
    "money is divided by 100 exactly once" rule. It goes through `formatMoney` — the same function
    `Money` itself calls — so there is still one implementation.

## What I did not do, and why

- **I did not delete eight pre-existing unused exports** (`BidStatus`, `PublicLotImage`, `UserRole`,
  `UserStatus`, `clockOffsetMs`, `isClockSynced`, `formatMoneyDelta`, `normalisePhone`). I checked
  each against `HEAD`: all eight were already unreferenced before I touched anything, so none is
  fallout from the deletion. Four are contract surface in a types file. Flagged in `CLAUDE.md`
  rather than swept up inside an unrelated change.
- **I did not remove framer-motion**, though its stated justification is gone. Four non-gesture
  components still use it. Flagged as a removal candidate.
- **I did not rewrite `NOTES.md`'s history.** It is a build log; superseded entries are marked as
  superseded and the new run is appended.

# Bidder app — how it works, and how to test it

The first half explains every screen and, more importantly, how bidding actually works — because
the model is not obvious and getting it wrong is how people feel tricked. The second half is a
test plan with expected results.

The admin portal has its own guide covering the operator side. Several scenarios here need
something set up over there first.

---

## Before you start

From the backend repo:

```bash
make dev-all    # the API *and* the lifecycle worker
make seed       # test accounts and a sample auction
```

**`make dev-all`, not `make dev`.** The worker is a separate process and it is what opens lots,
closes them, and fires the live events for both. Without it lots never open or close and half of
what is below cannot happen.

Then here:

```bash
npm run dev     # http://localhost:3000
```

Port 3000 matters — it is one of the two origins the backend allows. On another port every request
fails in a way that looks like the backend is down.

### Accounts

The OTP code is always `0000` while the backend runs locally.

Bidders: `+27820000002`, `+27820000003`, `+27820000004`. Full E.164 — `+27820000002`, not `082...`.

For anything involving two bidders, use a **private/incognito window** for the second. Two sessions
in the same browser will fight over storage.

---

## How bidding actually works

This is the part worth understanding before you touch anything.

**You bid the most you are willing to pay. The system pays the least it can.**

Enter R500 on a lot sitting at R100 and you become the leader at **R100**, with a hidden ceiling of
R500. If someone bids R200, the system automatically raises you to just above R200 — still yours,
still under your ceiling. You only ever pay one step more than the next-highest bidder, up to your
maximum.

Three consequences that look like bugs and are not:

**The price climbs with nobody doing anything.** That is two hidden ceilings competing. Perfectly
normal.

**You can be outbid the instant you bid.** If a rival's ceiling is higher than yours, the system
counter-bids for them immediately — you are outbid before the sheet closes. The bid succeeded; you
just lost. The app should say that plainly rather than showing an error.

**Raising your own maximum does not move the price.** You are already winning; there is nothing to
outbid. It also, deliberately, tells nobody — otherwise rivals would learn you had strengthened your
position.

**Maximums only go up.** You cannot lower one. That is a commitment, not a setting.

---

## Screens

### Signing in

Phone number, then a 4-box code. New numbers get an account automatically and are asked for a name.

The response is identical whether or not the number is registered — that is deliberate, so nobody
can use this to discover who has an account.

### Stack

The main screen, and the point of the product. One card per lot: photo, title, current bid (or
starting price if nobody has bid), bid count, countdown.

**Swipe left** — not interested. It leaves the stack, and is recoverable under My bids → Passed.

**Swipe right** — opens the bid sheet. **This is not a bid.** Money moves only when you confirm.
Dismiss the sheet and nothing has been spent — but the lot has left the stack and is now under
My bids → Interested.

There are buttons as well as gestures, and arrow keys work. Undo brings back the last card.

A lot with a reserve that has not been reached shows a quiet "reserve not met" marker. **You never
see the reserve amount.** Nobody bidding does.

### The bid sheet

One number: **the most you will pay.**

It shows what that means right now — *"You'll pay only what it takes to win, up to R500. Right now
that's R150."* — and it recalculates as you type. The confirm button repeats your ceiling, so the
last thing you see before committing is the number you are committing to.

Quick-add chips bump you by whole increments. The increment is not fixed: it scales with price, and
the server decides it.

Four things that can come back:

| Outcome | What it means |
|---|---|
| **Winning** | You lead. Your ceiling is shown so you remember it. |
| **Outbid** | Accepted, but a rival's ceiling is higher. Normal. Offers to raise. |
| **Too low** | Someone bid between the screen loading and you confirming. The minimum updates; try again. |
| **Closed** | The clock ran out. |

### Lot detail

Full photos, description, current bid, minimum next bid, countdown, whether you are leading, and
**your own maximum** — you can always see yours, never anyone else's.

From here you can raise your maximum, or stop automatic bidding. **Stopping does not retract
anything.** Your existing bids stand; the system just will not bid for you again.

Bid history shows amounts and pseudonymous handles. Bids marked automatic were placed by the proxy
engine — that is why prices move on their own.

### My bids

Three tabs:

**Bidding** — lots you have bid on, grouped by whether you are winning, outbid, or the lot has
ended. Outbid rows offer a one-tap raise.

**Interested** — lots you swiped right on but never actually bid on. This is where a dismissed bid
sheet leaves things.

**Passed** — lots you swiped left on. You can un-pass them back into the stack.

### Profile

Your name and optional email, and the theme setting: Light, Dark or System. Dark is the default and
the app's identity; light exists for daylight. System follows your device and shows which it
currently resolves to.

The theme is stored on this device only. Deliberately — your phone at night and your laptop in
daylight want different answers.

---

## What updates live, and what does not

Connected to a lot, you should see **without refreshing**: new bids and the price, the bid count,
the countdown when anti-snipe extends it, and the lot closing.

If the connection drops, the app catches up on reconnect. If it was away too long to replay
everything, it reloads from scratch instead. Either way the numbers should end up matching what the
admin portal shows — that comparison is the single most useful check in the whole test plan.

**Countdowns follow the server's clock, not your device's.** If your machine's time is wrong, close
times are still right.

**A lot reads as open based on its countdown, not its label.** For a few seconds after the clock
runs out, the underlying status still says live while bids are already refused. The countdown is the
truth.

---

# Test plan

Some of these need setup in the admin portal — its guide has the matching steps. Anything marked
**[two bidders]** needs a second private window.

## A. Getting in

**A1 — Sign in.** `+27820000002`, code `0000`.
*Expect:* straight in. If it is a fresh account, a name step first.

**A2 — Enter a local-format number** like `0820000002`.
*Expect:* refused with guidance to use `+27...`. The backend does not infer a country.

**A3 — Request a code six times in an hour.**
*Expect:* refused with a wait time. Note this locks that number out for the rest of the hour.

**A4 — Leave the tab for 20 minutes, then use it.**
*Expect:* it still works. The access token expires in 15 minutes and refreshes silently. You should
never be logged out for being idle.

## B. The stack

**B1 — Open a live auction.**
*Expect:* cards in lot order, photos, prices, countdowns. **No reserve amount anywhere on any
screen.**

**B2 — Swipe left.**
*Expect:* the card leaves. Under My bids → Passed. Un-passing puts it back.

**B3 — Swipe right, then dismiss without confirming.**
*Expect:* **no bid placed.** The lot is under My bids → Interested, not Passed, and not in the stack.

**B4 — Undo the last swipe.**
*Expect:* the card returns to the front.

**B5 — Use the buttons and the arrow keys instead of gestures.**
*Expect:* identical behaviour. Nothing is gesture-only.

**B6 — Swipe through every card.**
*Expect:* an empty state that offers your passed pile, not a blank screen.

**B7 — Find a lot with no photo** (create one in admin without images).
*Expect:* a sensible placeholder, not a broken image or an empty card.

## C. First bid — the proxy model

**C1 — On a lot at R100, bid with a maximum of R500.**
*Expect:* accepted, you are winning, and the price shows **R100**. If it shows R500 something is
badly wrong — stop and report it.

*Also check:* the sheet told you this would happen **before** you confirmed.

**C2 — Reopen the lot.**
*Expect:* your maximum of R500 is shown to you. The bid history shows only the visible R100.

**C3 — Try to lower your maximum to R300.**
*Expect:* refused, explained inline before it is even sent.

**C4 — Raise it to R900.**
*Expect:* accepted, price unchanged.

## D. Two bidders **[two bidders]**

**D1 — Bidder two bids R200 (maximum R200) on that same lot.**
*Expect:* **accepted, and immediately outbid.** The price moves to just above R200, bidder one still
leads. This must read as a normal auction outcome, with an offer to raise — not as a failure.

**D2 — Watch bidder one's window while D1 happens.**
*Expect:* the price updates live, no refresh. They are told they are still winning.

**D3 — Bidder two bids R2 000.**
*Expect:* bidder two takes the lead at roughly bidder one's ceiling plus one increment — **not** at
R2 000. Bidder one is told they have been outbid, promptly and clearly.

**D4 — Bidder one raises their maximum while leading.**
*Expect:* price unchanged, and **nothing at all appears in bidder two's window.**

**D5 — Open the bid history.**
*Expect:* automatic bids marked as such, handles not names or numbers, and **no maximums shown for
anyone**.

## E. Timing

**E1 — Have an admin move the auction's close time.**
*Expect:* your countdown updates live, in the right direction. It must handle the time moving
**earlier** as well as later.

**E2 — Bid inside the anti-snipe window** (last 5 minutes by default).
*Expect:* the countdown jumps out. Both bidder windows see it.

**E3 — Watch a lot close.**
*Expect:* the countdown reaching zero and the lot becoming unbiddable — no "place a bid" button on a
dead lot, even in the few seconds before the status catches up.

**E4 — Try to bid at the moment of closing.**
*Expect:* a clear "bidding closed" message, not a generic error.

**E5 — Look at a lot you won versus one that simply ended.**
*Expect:* different messages. Winning should be unmistakable.

## F. My bids

**F1 — Check the Bidding tab** with lots in several states.
*Expect:* winning, outbid and ended clearly separated. Your maximum shown per lot. Outbid rows offer
a raise.

**F2 — Raise from My bids** without opening the lot.
*Expect:* it works and the row updates.

**F3 — Check Interested.**
*Expect:* lots you swiped right on but never bid on. Once you bid, it should be obvious it has moved
on.

**F4 — Check Passed and un-pass one.**
*Expect:* it returns to the stack.

**F5 — Bid on lots in two different auctions.**
*Expect:* all of them here, correctly, with the right currency.

## G. Live behaviour

**G1 — Two windows on the same lot.** Bid in one.
*Expect:* the other updates within a moment. Price, count, and any outbid notice.

**G2 — Turn off the network for ten seconds**, have the other bidder bid twice, reconnect.
*Expect:* you catch up. No missing bids, no duplicates in the history. **Compare the price against
the admin Monitor.**

**G3 — Leave a window open on a lot for several minutes** with sporadic bids.
*Expect:* it stays current the whole time. No slow drift, no need to refresh.

**G4 — Watch the connection indicator** through G2.
*Expect:* honest — quiet when healthy, visible when not.

## H. Rough edges

**H1 — Double-tap confirm.**
*Expect:* exactly one bid. Check the history.

**H2 — Bid rapidly on one lot.**
*Expect:* a rate-limit message with a real wait time, then recovery. Not a crash. (60/min per lot.)

**H3 — Bid below the minimum** by having someone else bid first, then confirming a stale screen.
*Expect:* the sheet stays open, the minimum updates, one line explains why.

**H4 — Have an admin suspend you** while you are signed in.
*Expect:* your session ends promptly, including any live connection. Sign-in is refused.

**H5 — Have an admin void your winning bid.**
*Expect:* the lot reflects the new leader and price.

**H6 — Have an admin withdraw a lot you are bidding on.**
*Expect:* it shows as closed and cannot be bid on.

## I. Presentation

**I1 — Switch to Light** and walk every screen: sign-in, stack, bid sheet, lot detail, my bids,
profile, plus toasts, skeletons and empty states.
*Expect:* prices readable, accent visible, photos still dominant.

**I2 — Switch to System** and change your OS theme with the app open.
*Expect:* it follows immediately, no reload.

**I3 — Reload on each setting.**
*Expect:* no flash of the wrong theme.

**I4 — Use it on an actual phone**, or at 390px wide.
*Expect:* swipes feel right, nothing is cut off, buttons are thumb-reachable, and the bottom nav
clears the home indicator.

## J. Worth trying because real users will

**J1 — Bid the exact minimum** rather than a higher ceiling.
*Expect:* works, and you have no headroom — the next bid takes it.

**J2 — Bid on a lot, then stop automatic bidding.**
*Expect:* clear wording that your existing bid stands and only future automatic bidding stops.

**J3 — Swipe fast through twenty cards.**
*Expect:* no dropped swipes, no cards reappearing, and the next page loads before you run out.

**J4 — Open a lot by URL directly** while signed out.
*Expect:* sign-in, then landing on that lot rather than the home screen.

**J5 — Rotate the phone / resize mid-swipe.**
*Expect:* nothing gets stuck.

---

## Recording what you find

Note which step, what you expected, what happened, and whether it reproduces. For anything numeric,
**check the same number in the admin portal before reporting it** — whether both are wrong or only
one tells you immediately whether it is a display bug or a real one, and that is most of the
diagnosis.

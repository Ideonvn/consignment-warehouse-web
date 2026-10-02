# Bidder app — how it works, and how to test it

The first half explains every screen, and how bidding and accounts actually work — because neither
model is obvious and getting them wrong is how people feel tricked. The second half is a test plan
built around the seeded dataset.

The admin portal has its own guide. Several scenarios here need something done over there first.

---

## Before you start

From the backend repo:

```bash
make dev-all      # the API *and* the lifecycle worker
make seed-fresh   # wipe and rebuild the test dataset
```

**`make dev-all`, not `make dev`.** The worker is a separate process and it is what opens lots,
closes them, decides who won, and charges the winner. Without it half of what is below cannot
happen.

Then here:

```bash
npm run dev       # http://localhost:3400
```

Port 3400 matters — it is one of two origins the backend allows (the other is the admin portal on
3410). On another port every request fails in a way that looks like the backend being down.

Rate-limited while testing? **`make reset-limits`** in the backend clears the OTP and bid counters
instantly. Never wait an hour.

### The seeded dataset

`SEED.md` in the backend repo lists every account and auction, and points at the interesting lots.
Keep it open. The OTP is **`0000`** for everyone. Numbers are full E.164 — `+27820000002`, not
`082...`.

For anything involving two bidders, use a **private window** for the second, or the sessions will
fight.

**Bidders worth knowing about:**

Two numbers per bidder now: the **deposit held** (what lets you bid) and the **balance** (what you
owe). They move independently.

| Phone | Deposit held | Balance | Use it to test |
|---|---|---|---|
| `+27820000002/3/4` | R20 000 | R0 | Ordinary bidding, anywhere |
| `+27820000013` | R5 000 exactly | R0 | The deposit boundary — *must* be allowed into Autumn Jewellery |
| `+27820000014` | R4 999,99 | R0 | One cent short — *must* be refused, shortfall of 1c |
| `+27820000034` | R0 | R0 | Both books empty |
| `+27820000035` | R5 000 | **owing** | **Owes money and can still bid** |
| `+27820000036` | **R0** | in credit | **In credit and still refused** |
| `+27820000037` | R0 | R0 | A deposit paid and returned |
| `+27820000038` | R1 500 | R0 | A deposit book containing a correction |
| `+27820000015` | R0 | in credit | Every ledger entry type on one statement |
| `+27820000016` | R0 | in credit | A statement containing a correction |
| `+27820000020` | R30 000 | **deep in owing** | The "owing" statement, with a won lot and its commission |
| `+27820000032/33` | — | — | Suspended accounts |

Balances on accounts that have won lots move with the seed's random bidding, so `SEED.md` in the
backend repo is the authority on the exact figures.

**Auctions:**

| Slug | Status | Deposit | What it is for |
|---|---|---|---|
| `spring-collectables` | live | **R0** | Ungated — anyone can bid. The main testing ground. |
| `midweek-closing-soon` | live | R1 000 | Closes minutes after seeding |
| `autumn-jewellery-scheduled` | scheduled | R5 000 | The deposit-boundary auction |
| `summer-antiques-ended` | ended | R2 000 | Won and lost lots |
| `winter-estate-draft` | draft | — | **Must never appear here at all** |

---

## How bidding works

**You bid the most you are willing to pay. The system pays the least it can.**

Enter R500 on a lot at R100 and you lead at **R100**, with a hidden ceiling of R500. If someone bids
R200 the system raises you automatically to just above R200 — still yours, still under your ceiling.
You only ever pay one step more than the next-highest bidder.

Three consequences that look like bugs and are not:

**The price climbs with nobody doing anything.** Two hidden ceilings competing.

**You can be outbid the instant you bid.** If a rival's ceiling is higher, the system counter-bids
for them immediately — you are outbid before the sheet closes. The bid succeeded; you lost. The app
should say that plainly rather than showing an error.

**Raising your own maximum does not move the price**, and tells nobody. You are already winning, and
signalling it would hand rivals information.

**Maximums only go up.** That is a commitment, not a setting.

---

## How your account works

**Two numbers, and they answer different questions.**

Your **deposit** is what the warehouse holds for you. It is the only thing that decides whether you
can bid. It is *held*, not spent — winning a lot never uses it up — and it comes back when you ask
for it back.

Your **balance** is the trading account: what you owe for lots you won, or credit sitting against
the next invoice. Positive is credit, negative means you owe.

So R10 000 of deposit lodged and then R12 000 won leaves the deposit at **R10 000** and the balance
at **−R12 000**. You owe R12 000 and you can still bid. That is deliberate: a deposit is an entry
ticket, not margin against each lot.

**Each auction says what deposit you need to be holding before you can bid in it.** Bigger lots,
bigger deposit. One deposit covers every auction asking for that much or less, and you are eligible
the moment it is recorded, with no action by anyone.

**Browsing is completely free.** The auction list, the card stack, swiping in *both* directions, lot
detail and bid history all work with no deposit and no credit. The only thing gated is placing a
bid. You should be able to explore an entire auction and then decide it is worth putting money
down.

---

## Screens

### Signing in

Phone, then a 4-box code. New numbers get an account and are asked for a name. The response is
identical whether or not a number is registered — deliberately, so nobody can use it to discover
who has an account.

### Stack

One card per lot: photo, title, current bid (or starting price), bid count, countdown.

**Swipe left** — not interested. Leaves the stack, recoverable under My bids → Passed.

**Swipe right** — opens the bid sheet. **This is not a bid.** Money moves only on confirm. Dismiss
it and nothing is spent, but the lot has left the stack and sits under My bids → Interested.

Buttons and arrow keys work too. Undo brings back the last card. A lot with an unmet reserve shows a
quiet marker — **you never see the reserve amount.**

### The bid sheet

One number: **the most you will pay.** It shows what that means right now — *"You'll pay only what
it takes to win, up to R500. Right now that's R150."* — recalculating as you type, and the confirm
button repeats your ceiling.

Quick-add chips bump by whole increments. The increment is not fixed; it scales with price and the
server decides it.

| Outcome | Meaning |
|---|---|
| **Winning** | You lead. Your ceiling is shown so you remember it. |
| **Outbid** | Accepted, but a rival's ceiling is higher. Normal. Offers to raise. |
| **Too low** | Someone bid between the screen loading and you confirming. The minimum updates. |
| **Closed** | The clock ran out. |
| **Deposit needed** | The deposit we hold is less than this auction requires. It tells you what is held, what is needed, and what to pay in. It says nothing about what you owe, because that is not what is stopping you. |

### Lot detail

Photos, description, current bid, minimum next bid, countdown, whether you are leading, and **your
own maximum**. You can raise it, or stop automatic bidding — **stopping does not retract anything**;
your bids stand, the system just will not bid for you again.

Bid history shows amounts and pseudonymous handles. Automatic bids are marked — that is why prices
move on their own.

### My bids

**Bidding** — lots you have bid on, grouped by winning, outbid, or ended. Outbid rows offer a
one-tap raise.
**Interested** — swiped right but never actually bid. Where a dismissed bid sheet leaves things.
**Passed** — swiped left. You can un-pass them.

### Account

From Profile. **The deposit comes first**: what is held, and every movement that got it there. Then
the balance in plain language — *"R2 000 due"* or *"R10 000 on account"* — and the statement: what
each entry was, when, the amount, and the balance after it. Charges and credits are distinct.

The two lists are separate because the two books are. A won lot never appears on the deposit list,
and a deposit never appears on the statement.

A **correction** is a reversal of an earlier entry, on either book. It appears as its own line and is
never netted away — both are histories.

If you owe money, that is an invoice, not an error. The screen also tells you how to pay.

### Profile

Name, optional email, and the theme: Light, Dark or System. Dark is the default and the app's
identity; light is for daylight. Stored on this device only, deliberately.

---

## What updates live

Watching a lot, you should see **without refreshing**: new bids and the price, the bid count, the
countdown when anti-snipe extends it, and the lot closing — including *how* it ended, so winning and
losing read differently.

If the connection drops it catches up on reconnect; if it was away too long it reloads instead.
Either way the numbers should match the admin portal — that comparison is the most useful check in
this whole plan.

**Countdowns follow the server's clock**, not your device's.

**A lot is open based on its countdown, not its label.** For a few seconds after zero the status
still says live while bids are already refused. The countdown is the truth.

Your statement is **not** a live screen — winning a lot charges you, but the balance refreshes on
your next visit rather than instantly. That is deliberate.

---

# Test plan

Some steps need the admin portal; its guide has the matching halves. **[two bidders]** needs a
second private window.

Re-seed first so the time-sensitive auctions are fresh.

## A. Getting in

**A1 — Sign in** as `+27820000002`, code `0000`.
*Expect:* straight in, four live/ended auctions listed. **`winter-estate-draft` must not appear.**

**A2 — Enter `0820000002`** (local format).
*Expect:* refused with guidance to use `+27...`.

**A3 — Sign in as `+27820000032`** (suspended).
*Expect:* refused clearly, not a crash.

**A4 — Sign in as `+27820000028`** (no name set).
*Expect:* the name step.

**A5 — Leave a tab 20 minutes, then use it.**
*Expect:* still works. Access tokens last 15 minutes and refresh silently; you should never be
logged out for being idle.

## B. The stack

**B1 — Open `spring-collectables`.**
*Expect:* cards in lot order with photos, prices, countdowns. **No reserve amount anywhere.**

**B2 — Swipe left, then check My bids → Passed, then un-pass.**
*Expect:* it leaves, it is listed, it comes back.

**B3 — Swipe right, dismiss without confirming.**
*Expect:* **no bid.** Under Interested, not Passed, and out of the stack.

**B4 — Undo the last swipe.**
*Expect:* the card returns to the front.

**B5 — Buttons and arrow keys.**
*Expect:* identical behaviour. Nothing is gesture-only.

**B6 — Find lot 3** (no images).
*Expect:* a sensible placeholder, not a broken card.

**B7 — Find lot 4** (images, none primary) and **lot 5** (primary is not the first).
*Expect:* lot 4 shows its lowest-position image; lot 5 shows the flagged one.

**B8 — Swipe through everything.**
*Expect:* an empty state offering the passed pile.

## C. Bidding — the proxy model

Use `spring-collectables`; it has no deposit, so nothing is gated.

**C1 — On a low-priced lot, bid with a maximum of R500.**
*Expect:* accepted, winning, and the price shows the **starting price**, not R500. If it shows R500,
stop and report it. The sheet should have said so before you confirmed.

**C2 — Reopen the lot.**
*Expect:* your R500 maximum shown to you; the history shows only the visible amount.

**C3 — Try to lower your maximum.**
*Expect:* refused inline, before it is sent.

**C4 — Open lot 7** (R333 increment override).
*Expect:* the minimum next bid steps by R333, not the usual band.

**C5 — Open lot 9** (255 bids).
*Expect:* history pages rather than loading everything at once.

## D. Two bidders **[two bidders]**

**D1 — Bidder two bids just above the current price with no headroom.**
*Expect:* **accepted and immediately outbid**, price moving to just above their number, bidder one
still leading. It must read as a normal outcome with an offer to raise.

**D2 — Watch bidder one's window** while that happens.
*Expect:* live update, told they are still winning.

**D3 — Bidder two bids well above bidder one's ceiling.**
*Expect:* bidder two leads at roughly bidder one's ceiling plus one increment — **not** at their own
number. Bidder one is told promptly.

**D4 — Bidder one raises their maximum while leading.**
*Expect:* price unchanged, and **nothing appears in bidder two's window.**

**D5 — Check the history.**
*Expect:* automatic bids marked, handles not names, **no maximums for anyone**.

## E. Deposits — the newest code

**E1 — Sign in as `+27820000034`** (both books empty). Browse `autumn-jewellery-scheduled` once it
opens: enter the stack, swipe **both** directions, open lot detail, read bid history.
*Expect:* all of it works. Nothing blurred, blocked or nagging.

**E2 — Try to bid.**
*Expect:* refused with the deposit held, what the auction needs, and what to pay in — not "you are
not eligible". Plus a route to your account and a note on how to pay. **No mention of what you owe**:
that is not what is stopping you.

**E3 — Sign in as `+27820000014`** (holding R4 999,99 against a R5 000 deposit) and try to bid.
*Expect:* refused with a shortfall of **one cent**.

**E4 — Sign in as `+27820000013`** (holding exactly R5 000) and bid.
*Expect:* allowed. That boundary must match the admin Participants list exactly.

**E5 — Have an admin record the missing cent of deposit for `+27820000014`**, then retry **in the
same session without reloading**.
*Expect:* the bid now succeeds.

**E6 — Sign in as `+27820000035`** — owes money, holds a R5 000 deposit — and bid in the same auction.
*Expect:* **allowed.** Owing money does not gate bidding. This is the case the two books exist for.

**E7 — Sign in as `+27820000036`** — in credit, no deposit — and try to bid.
*Expect:* **refused.** Credit on the trading account is not a deposit. Check the card's deposit note
says the deposit is not covered.

**E8 — Sign in as `+27820000002`** (R20 000 deposit) and bid in the same auction.
*Expect:* you never see any of this. No deposit messaging on the path to a bid.

## F. Your deposit and your statement

**F1 — As `+27820000034`**, open Account.
*Expect:* a deposit of zero with an honest line about what that means, and an empty statement. Not a
broken screen.

**F2 — As `+27820000002`**, open Account.
*Expect:* the deposit **above** the balance, with its own list of movements. A won lot never appears
on the deposit list.

**F3 — As `+27820000038`**, open Account.
*Expect:* a correction on the **deposit** list, shown as its own line and not netted away. The held
figure reflects only the entry that stands.

**F4 — As `+27820000037`**, open Account.
*Expect:* a deposit received and then returned, both visible, nothing held now.

**F5 — As `+27820000015`**, open it.
*Expect:* human labels on the statement — "Lot won", "Commission", not raw names. Charges and credits
distinct. **No deposit line on the statement**: deposits are not recorded there any more.

**F6 — As `+27820000016`.**
*Expect:* the correction shown as its own line, **not** netted against what it corrects.

**F7 — As `+27820000020`** (deep in owing, and holding a deposit).
*Expect:* the balance stated as **due**, in plain language. A won lot and a **separate** commission
line. It should read as an invoice, not an error — and the deposit above it should be untouched by
any of it.

**F8 — Page the statement.**
*Expect:* the running balance **continues** across the page break rather than restarting. Same for
the deposit list.

## G. Timing

**G1 — Have an admin move the auction's close time**, both later and earlier.
*Expect:* your countdown follows, in both directions.

**G2 — Bid inside the anti-snipe window** on `midweek-closing-soon`.
*Expect:* the countdown jumps out. Both bidder windows see it.

**G3 — Watch a lot close.**
*Expect:* no "place a bid" button on a dead lot, even in the seconds before the status catches up.

**G4 — Compare a lot you won against one that simply ended.**
*Expect:* clearly different messages.

**G5 — Have an admin accept a reserve** on a lot you bid on in `summer-antiques-ended`.
*Expect:* it updates **live**, without navigating away and back.

## H. Live behaviour

**H1 — Two windows on one lot.** Bid in one.
*Expect:* the other updates within a moment.

**H2 — Network off ten seconds**, other bidder bids twice, reconnect.
*Expect:* you catch up. No missing bids, no duplicates. **Compare the price against the admin
Monitor.**

**H3 — Leave a window open on lot 9** with sporadic bids for several minutes.
*Expect:* stays current, no drift, no refresh needed.

## I. Rough edges

**I1 — Double-tap confirm.**
*Expect:* exactly one bid.

**I2 — Bid rapidly on one lot.**
*Expect:* a rate-limit message with a real wait, then recovery. (60/min per lot.)

**I3 — Bid from a stale screen** after someone else has bid.
*Expect:* the sheet stays open, the minimum updates, one line explains why.

**I4 — Have an admin suspend you** while signed in.
*Expect:* your session ends promptly, including the live connection.

**I5 — Have an admin void your winning bid, or withdraw a lot you are bidding on.**
*Expect:* both reflected correctly.

## J. Presentation

**J1 — Switch to Light** and walk everything, including the statement, the refusal panel, toasts,
skeletons and empty states.
*Expect:* prices readable, accent visible, photos still dominant.

**J2 — System**, then change your OS theme with the app open.
*Expect:* follows immediately, no reload, no flash.

**J3 — Use it on a real phone**, or at 390px.
*Expect:* swipes feel right, nothing cut off, the bottom nav clears the home indicator. **Raise a
maximum from My bids on a real device** — the keyboard should stay up with no flashing.

## K. Worth trying because real users will

**K1 — Bid the exact minimum**, no headroom.
*Expect:* works; the next bid takes it.

**K2 — Stop automatic bidding.**
*Expect:* clear wording that existing bids stand.

**K3 — Swipe fast through twenty cards.**
*Expect:* no dropped swipes, no reappearing cards, the next page loads before you run out.

**K4 — Open a lot by URL while signed out.**
*Expect:* sign in, then land on that lot.

---

## Recording what you find

Note the step, what you expected, what happened, and whether it reproduces. For any figure,
**check it in the admin portal before reporting** — whether both are wrong or only one is most of
the diagnosis. For anything about money, check the ledger there too: it is the source of truth, and
a screen disagreeing with it is a different bug from the ledger being wrong.

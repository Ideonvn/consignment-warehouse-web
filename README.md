# Consignment Warehouse — web

The bidder-facing web app for Consignment Warehouse, an auction platform replacing a business that
used to run inside WhatsApp groups.

The product is a **stack of cards**, one per lot: swipe left to pass, swipe right to open the bid
sheet. A swipe right is not a bid — money only moves when someone confirms in the sheet. A second
screen shows what they're bidding on and whether they're winning. Everything else — auction list,
lot detail, profile — is deliberately secondary.

The admin portal is a separate project.

## Prerequisites

- **Node.js 20.9+** (Next.js 16 requirement).
- **The backend running locally**, from the API repo:
  ```bash
  make dev    # serves http://localhost:8000
  make seed   # test accounts and a live auction with lots
  ```
  While the backend runs with `APP_ENV=local` the OTP code is always `0000`.

Seeded bidders: `+27820000002`, `+27820000003`, `+27820000004`. Admin: `+27820000001`.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

Sign in with a seeded number in full E.164 form (`+27820000004`) and the code `0000`. The backend
does not infer a country from a local `082…` format.

## Environment variables

| Variable | Purpose | Local value |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | REST base URL, no trailing slash | `http://localhost:8000/api/v1` |
| `NEXT_PUBLIC_WS_URL` | WebSocket endpoint for live bid events | `ws://localhost:8000/api/v1/ws` |

Both are documented in `.env.example`.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (flat config, `eslint-config-next`) |
| `npm run typecheck` | `tsc --noEmit` |

## Architecture

A **client-heavy SPA inside the Next.js App Router**. The server does routing, layouts and metadata;
everything that touches data is a client component, because the access token is held in memory and
the live layer is a websocket — server rendering authenticated data would buy nothing and cost a
lot of plumbing. `app/(app)/` is the authenticated shell (guard, bottom nav, realtime provider);
`app/login/*` and `app/welcome` sit outside it. **React Query** owns server state and is the single
place any screen reads from: the REST client, the bid response and the websocket all write into the
same cache, so no component does its own event wiring. **Zustand** holds the two things that aren't
server state — the session (access token in memory only; the refresh token stays in an HttpOnly
cookie) and the realtime connection status and per-lot sequence cursors. **Zod** validates every
response at the boundary and `types/api.ts` is inferred from those schemas, so a backend change
surfaces as one clear parse error instead of an `undefined` three components deep. **framer-motion**
owns the gesture layer — card drag physics and sheet transitions.

Three pieces carry most of the risk and are worth reading first: `lib/api/client.ts` (single-flight
token refresh — parallel 401s await one refresh, because replaying a rotated refresh token makes the
backend revoke the whole family), `components/bid/BidSheet.tsx` (the one-number "your maximum" flow,
its idempotency-key lifecycle and its four outcome states), and `lib/realtime/socket.ts` (ticket per
connection attempt, jittered backoff, and `after_sequence` resubscription so a reconnect replays
exactly what was missed).

Money is an integer number of cents everywhere; `components/ui/Money.tsx` is the only place it
becomes text. Countdowns are anchored to the server clock — the offset comes from the `Date` header
on every response — so a device with a wrong clock never sees a wrong closing time.

`NOTES.md` records the judgement calls, the things the API made awkward, and the end-to-end
verification run.

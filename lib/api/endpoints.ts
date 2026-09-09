import { apiGet, apiRequest, type ApiResult } from "@/lib/api/client";
import {
  accountSchema,
  auctionListSchema,
  auctionSchema,
  bidListSchema,
  bidResultSchema,
  detailSchema,
  lotCardListSchema,
  lotDetailSchema,
  lotSearchResultListSchema,
  myBidListSchema,
  tokenPairSchema,
  userSchema,
  wsTicketSchema,
} from "@/lib/api/schemas";
import type {
  Account,
  Auction,
  AuctionStatus,
  Bid,
  BidResult,
  LotCard,
  LotDetail,
  LotSearchResult,
  MyBid,
  NotificationChannel,
  TokenPair,
  User,
  WsTicket,
} from "@/types/api";

/* ---------------------------------------------------------------- auth --- */

export function requestOtp(phone: string): Promise<{ detail: string }> {
  return apiGet("/auth/otp/request", {
    method: "POST",
    body: { phone },
    schema: detailSchema,
    auth: false,
  });
}

export function verifyOtp(input: {
  phone: string;
  code: string;
  device_id: string;
  device_name: string;
}): Promise<TokenPair> {
  return apiGet("/auth/otp/verify", {
    method: "POST",
    body: input,
    schema: tokenPairSchema,
    auth: false,
  });
}

export function logout(allDevices = false): Promise<{ detail: string }> {
  return apiGet("/auth/logout", {
    method: "POST",
    body: {},
    query: { all_devices: allDevices },
    schema: detailSchema,
    auth: false,
  });
}

export function getMe(): Promise<User> {
  return apiGet("/auth/me", { schema: userSchema });
}

export function updateMe(input: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): Promise<User> {
  return apiGet("/auth/me", { method: "PATCH", body: input, schema: userSchema });
}

/** Sends a code to the address already on the account. Authenticated, and no body. */
export function requestEmailVerification(): Promise<{ detail: string }> {
  return apiGet("/auth/email/verify/request", {
    method: "POST",
    body: {},
    schema: detailSchema,
  });
}

/** Consumes the code. Returns the updated profile and no token — this is not a login. */
export function verifyEmail(code: string): Promise<User> {
  return apiGet("/auth/email/verify", { method: "POST", body: { code }, schema: userSchema });
}

/**
 * Marketing consent, one channel at a time or several at once. **Omitted
 * channels are left untouched by the server**, so callers send only what the
 * user actually changed rather than restating choices they didn't make.
 */
export function setNotificationPreferences(
  input: Partial<Record<NotificationChannel, boolean>>,
): Promise<User> {
  return apiGet("/auth/me/notification-preferences", {
    method: "PUT",
    body: input,
    schema: userSchema,
  });
}

/* ------------------------------------------------------------ auctions --- */

/**
 * **The server already excludes anything that ended more than two weeks ago.**
 * Do not filter for that here — one copy of the rule, on the side that owns it.
 */
export function listAuctions(params: {
  status?: AuctionStatus;
  limit?: number;
  offset?: number;
} = {}): Promise<Auction[]> {
  return apiGet("/auctions", { schema: auctionListSchema, query: params });
}

export function getAuction(auctionId: string): Promise<Auction> {
  return apiGet(`/auctions/${auctionId}`, { schema: auctionSchema });
}

/* ---------------------------------------------------------------- lots --- */

export function listLots(
  auctionId: string,
  params: { cursor?: number; limit?: number } = {},
): Promise<ApiResult<LotCard[]>> {
  return apiRequest(`/auctions/${auctionId}/lots`, {
    schema: lotCardListSchema,
    query: params,
  });
}

/**
 * Every lot this caller can see, across every auction.
 *
 * **The two-week window that hides old auctions from `GET /auctions` does not
 * apply here** — search exists to answer "what did that go for". The server
 * owns that exemption; nothing in this client re-applies the window, and
 * nothing here may assert a bid state joined from `/me/bids`, which *is*
 * windowed. See "Lot search" in CLAUDE.md.
 *
 * `cursor` is **opaque**: it carries the compound sort key and a pinned
 * instant. Pass back `X-Next-Cursor` verbatim; never parse, decode or build one
 * — the server answers a malformed cursor with a 422.
 */
export function searchLots(params: {
  q: string;
  cursor?: string;
  limit?: number;
}): Promise<ApiResult<LotSearchResult[]>> {
  return apiRequest("/lots/search", { schema: lotSearchResultListSchema, query: params });
}

export function getLot(lotId: string): Promise<LotDetail> {
  return apiGet(`/lots/${lotId}`, { schema: lotDetailSchema });
}

export function listBids(
  lotId: string,
  params: { cursor?: number; limit?: number } = {},
): Promise<ApiResult<Bid[]>> {
  return apiRequest(`/lots/${lotId}/bids`, { schema: bidListSchema, query: params });
}

/* ------------------------------------------------------------- bidding --- */

export function placeBid(
  lotId: string,
  input: {
    amount_minor: number;
    max_amount_minor?: number;
    client_request_id: string;
  },
): Promise<BidResult> {
  return apiGet(`/lots/${lotId}/bids`, {
    method: "POST",
    body: input,
    schema: bidResultSchema,
  });
}

export function setAutoBid(
  lotId: string,
  input: { max_amount_minor: number; client_request_id: string },
): Promise<BidResult> {
  return apiGet(`/lots/${lotId}/auto-bid`, {
    method: "PUT",
    body: input,
    schema: bidResultSchema,
  });
}

export function cancelAutoBid(lotId: string): Promise<void> {
  return apiGet(`/lots/${lotId}/auto-bid`, { method: "DELETE" });
}

/**
 * Every lot this user has money on. **The server already excludes anything whose
 * auction ended more than two weeks ago** — never filter for that again here: a
 * second copy of the rule is a second thing to keep in step.
 */
export function listMyBids(
  params: { active_only?: boolean; limit?: number } = {},
): Promise<MyBid[]> {
  return apiGet("/me/bids", { schema: myBidListSchema, query: params });
}

/* -------------------------------------------------------------- account --- */

/** The caller's own statement. There is no route to anyone else's. */
export function getMyAccount(
  params: { limit?: number; offset?: number } = {},
): Promise<ApiResult<Account>> {
  return apiRequest("/me/account", { schema: accountSchema, query: params });
}

/* ------------------------------------------------------------ realtime --- */

export function createWsTicket(): Promise<WsTicket> {
  return apiGet("/ws/ticket", { method: "POST", body: {}, schema: wsTicketSchema });
}

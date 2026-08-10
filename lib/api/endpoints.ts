import { apiGet, apiRequest, type ApiResult } from "@/lib/api/client";
import {
  auctionListSchema,
  auctionSchema,
  bidListSchema,
  bidResultSchema,
  detailSchema,
  lotCardListSchema,
  lotDetailSchema,
  myBidListSchema,
  swipeSchema,
  tokenPairSchema,
  userSchema,
  wsTicketSchema,
} from "@/lib/api/schemas";
import type {
  Auction,
  AuctionStatus,
  Bid,
  BidResult,
  LotCard,
  LotDetail,
  MyBid,
  Swipe,
  SwipeDirection,
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

/* ------------------------------------------------------------ auctions --- */

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
  params: {
    include_swiped?: boolean;
    direction?: SwipeDirection;
    cursor?: number;
    limit?: number;
  } = {},
): Promise<ApiResult<LotCard[]>> {
  return apiRequest(`/auctions/${auctionId}/lots`, {
    schema: lotCardListSchema,
    query: params,
  });
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

/* -------------------------------------------------------------- swipes --- */

export function setSwipe(lotId: string, direction: SwipeDirection): Promise<Swipe> {
  return apiGet(`/lots/${lotId}/swipe`, {
    method: "PUT",
    body: { direction },
    schema: swipeSchema,
  });
}

export function deleteSwipe(lotId: string): Promise<void> {
  return apiGet(`/lots/${lotId}/swipe`, { method: "DELETE" });
}

/**
 * Every lot this user has swiped, across auctions, most-recently-swiped first.
 * Same card shape as the stack, so rows render directly.
 */
export function listMySwipes(
  params: { direction?: SwipeDirection; limit?: number; offset?: number } = {},
): Promise<LotCard[]> {
  return apiGet("/me/swipes", { schema: lotCardListSchema, query: params });
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

export function listMyBids(
  params: { active_only?: boolean; limit?: number } = {},
): Promise<MyBid[]> {
  return apiGet("/me/bids", { schema: myBidListSchema, query: params });
}

/* ------------------------------------------------------------ realtime --- */

export function createWsTicket(): Promise<WsTicket> {
  return apiGet("/ws/ticket", { method: "POST", body: {}, schema: wsTicketSchema });
}

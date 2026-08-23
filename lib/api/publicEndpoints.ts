import { publicGet, publicRequest, type PublicPage } from "@/lib/api/publicClient";
import {
  publicAuctionListSchema,
  publicAuctionSchema,
  publicLotCardListSchema,
  publicLotDetailSchema,
  publicLotPriceListSchema,
} from "@/lib/api/publicSchemas";
import type {
  PublicAuction,
  PublicLotCard,
  PublicLotDetail,
  PublicLotPrice,
} from "@/types/api";

/**
 * The anonymous catalogue.
 *
 * Every one of these is safe to call from a server render: no token, no cookie,
 * no session. `revalidate` is passed where a server caller wants Next's data
 * cache — the browser ignores it.
 */

export function listPublicAuctions(
  params: { limit?: number; offset?: number } = {},
): Promise<PublicAuction[]> {
  return publicGet("/public/auctions", { query: params, schema: publicAuctionListSchema });
}

export function getPublicAuction(
  auctionId: string,
  options: { revalidate?: number } = {},
): Promise<PublicAuction> {
  return publicGet(`/public/auctions/${auctionId}`, {
    schema: publicAuctionSchema,
    revalidate: options.revalidate,
  });
}

export function listPublicLots(
  auctionId: string,
  params: { cursor?: number; limit?: number } = {},
): Promise<PublicPage<PublicLotCard[]>> {
  return publicRequest(`/public/auctions/${auctionId}/lots`, {
    query: params,
    schema: publicLotCardListSchema,
  });
}

export function getPublicLot(
  lotId: string,
  options: { revalidate?: number } = {},
): Promise<PublicLotDetail> {
  return publicGet(`/public/lots/${lotId}`, {
    schema: publicLotDetailSchema,
    revalidate: options.revalidate,
  });
}

/** The three things that move, for polling. No cache: this is the live layer. */
export function listPublicPrices(auctionId: string): Promise<PublicLotPrice[]> {
  return publicGet(`/public/auctions/${auctionId}/prices`, {
    schema: publicLotPriceListSchema,
  });
}

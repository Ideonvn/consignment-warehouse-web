import type { z } from "zod";
import type {
  accountSchema,
  auctionSchema,
  auctionStatusSchema,
  bidResultSchema,
  bidSchema,
  bidStatusSchema,
  lotCardSchema,
  lotDetailSchema,
  lotImageSchema,
  ledgerEntrySchema,
  ledgerEntryTypeSchema,
  lotSearchResultSchema,
  lotStatusSchema,
  myBidSchema,
  notificationChannelSchema,
  notificationPreferenceSchema,
  serverMessageSchema,
  tokenPairSchema,
  userSchema,
  wsTicketSchema,
} from "@/lib/api/schemas";
import type {
  publicAuctionSchema,
  publicLotCardSchema,
  publicLotDetailSchema,
  publicLotImageSchema,
  publicLotPriceSchema,
} from "@/lib/api/publicSchemas";

/**
 * The API contract. Types are derived from the zod schemas so the compile-time
 * and runtime views of the backend can never drift apart.
 */

export type User = z.infer<typeof userSchema>;
export type UserStatus = User["status"];
export type UserRole = User["role"];
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;
export type TokenPair = z.infer<typeof tokenPairSchema>;

export type Auction = z.infer<typeof auctionSchema>;
export type AuctionStatus = z.infer<typeof auctionStatusSchema>;

export type LotCard = z.infer<typeof lotCardSchema>;
export type LotDetail = z.infer<typeof lotDetailSchema>;
export type LotImage = z.infer<typeof lotImageSchema>;
export type LotStatus = z.infer<typeof lotStatusSchema>;

/**
 * A search row. **A structural superset of `LotSummary`**, so the presentational
 * row takes it unchanged — which is why `LotSummary` was *not* widened to carry
 * `auction_name` or `currency_code`: those exist on the search shape only, and
 * `LotSummary`'s whole job is naming what the member *and* anonymous card
 * shapes both have.
 */
export type LotSearchResult = z.infer<typeof lotSearchResultSchema>;

export type Bid = z.infer<typeof bidSchema>;
export type BidStatus = z.infer<typeof bidStatusSchema>;
export type BidResult = z.infer<typeof bidResultSchema>;
export type MyBid = z.infer<typeof myBidSchema>;

export type Account = z.infer<typeof accountSchema>;
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
export type LedgerEntryType = z.infer<typeof ledgerEntryTypeSchema>;

export type WsTicket = z.infer<typeof wsTicketSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;

export type ClientMessage =
  | {
      action: "subscribe";
      lot_ids: string[];
      /** Per-lot resume points. Wins over the scalar form when present. */
      after_sequences?: Record<string, number>;
      after_sequence?: number;
    }
  | { action: "unsubscribe"; lot_ids: string[] }
  | { action: "resync"; lot_id: string; after_sequence: number }
  | { action: "ping" };

/* --------------------------------------------------------------- public --- */

/**
 * The anonymous catalogue. Inferred from `lib/api/publicSchemas.ts`, which is a
 * separate contract on purpose: none of these carry per-user fields.
 */
export type PublicAuction = z.infer<typeof publicAuctionSchema>;
export type PublicLotCard = z.infer<typeof publicLotCardSchema>;
export type PublicLotDetail = z.infer<typeof publicLotDetailSchema>;
export type PublicLotImage = z.infer<typeof publicLotImageSchema>;
export type PublicLotPrice = z.infer<typeof publicLotPriceSchema>;

/**
 * What a presentational lot component actually needs.
 *
 * Both `LotCard` and `PublicLotCard` satisfy this, which is how one `LotList`
 * serves a member and a stranger without being told which it is looking at.
 * Widen it only with fields that exist on *both* sides — `my_auto_bid_max_minor`
 * and `am_i_leading` are member-only and deliberately absent here.
 */
export type LotSummary = Pick<
  LotCard,
  | "id"
  | "auction_id"
  | "lot_number"
  | "title"
  | "status"
  | "starting_price_minor"
  | "current_bid_minor"
  | "minimum_next_bid_minor"
  | "bid_count"
  | "effective_ends_at"
  | "reserve_met"
  | "primary_image_url"
>;

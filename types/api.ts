import type { z } from "zod";
import type {
  auctionSchema,
  auctionStatusSchema,
  bidResultSchema,
  bidSchema,
  bidStatusSchema,
  lotCardSchema,
  lotDetailSchema,
  lotImageSchema,
  lotStatusSchema,
  myBidSchema,
  serverMessageSchema,
  swipeDirectionSchema,
  swipeSchema,
  tokenPairSchema,
  userSchema,
  wsTicketSchema,
} from "@/lib/api/schemas";

/**
 * The API contract. Types are derived from the zod schemas so the compile-time
 * and runtime views of the backend can never drift apart.
 */

export type User = z.infer<typeof userSchema>;
export type UserStatus = User["status"];
export type UserRole = User["role"];
export type TokenPair = z.infer<typeof tokenPairSchema>;

export type Auction = z.infer<typeof auctionSchema>;
export type AuctionStatus = z.infer<typeof auctionStatusSchema>;

export type LotCard = z.infer<typeof lotCardSchema>;
export type LotDetail = z.infer<typeof lotDetailSchema>;
export type LotImage = z.infer<typeof lotImageSchema>;
export type LotStatus = z.infer<typeof lotStatusSchema>;

export type SwipeDirection = z.infer<typeof swipeDirectionSchema>;
export type Swipe = z.infer<typeof swipeSchema>;

export type Bid = z.infer<typeof bidSchema>;
export type BidStatus = z.infer<typeof bidStatusSchema>;
export type BidResult = z.infer<typeof bidResultSchema>;
export type MyBid = z.infer<typeof myBidSchema>;

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

import { z } from "zod";

/**
 * Runtime contract for every response shape the backend returns.
 * `types/api.ts` derives its types from these, so schema drift shows up as a
 * parse error at the boundary rather than an `undefined` deep in a component.
 */

/* ---------------------------------------------------------------- auth --- */

export const userSchema = z.object({
  id: z.string(),
  phone_e164: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email: z.string().nullable(),
  status: z.enum(["active", "suspended", "deleted"]),
  role: z.enum(["bidder", "admin", "superadmin"]),
  is_phone_verified: z.boolean(),
  last_login_at: z.string().nullable(),
  created_at: z.string(),
});

export const tokenPairSchema = z.object({
  access_token: z.string(),
  // Web receives the refresh token as an HttpOnly cookie; the body copy is for
  // native clients and is deliberately never persisted here.
  refresh_token: z.string().nullish(),
  token_type: z.string(),
  expires_in: z.number(),
});

export const detailSchema = z.object({ detail: z.string() });

/* ------------------------------------------------------------ auctions --- */

export const auctionStatusSchema = z.enum([
  "draft",
  "scheduled",
  "live",
  "ended",
  "settled",
  "cancelled",
]);

export const auctionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  status: auctionStatusSchema,
  starts_at: z.string(),
  ends_at: z.string(),
  currency_code: z.string(),
  anti_snipe_window_seconds: z.number(),
  anti_snipe_extension_seconds: z.number(),
  max_extensions: z.number(),
  // Declared with a server-side default rather than as required.
  lot_count: z.number().default(0),
});

export const auctionListSchema = z.array(auctionSchema);

/* ---------------------------------------------------------------- lots --- */

export const lotStatusSchema = z.enum([
  "draft",
  "scheduled",
  "live",
  "ended_sold",
  "ended_unsold",
  "ended_reserve_not_met",
  "withdrawn",
  "cancelled",
]);

export const swipeDirectionSchema = z.enum(["pass", "interested"]);

export const lotCardSchema = z.object({
  id: z.string(),
  auction_id: z.string(),
  lot_number: z.number(),
  title: z.string(),
  status: lotStatusSchema,
  starting_price_minor: z.number(),
  current_bid_minor: z.number().nullable(),
  minimum_next_bid_minor: z.number(),
  bid_count: z.number(),
  bid_sequence: z.number(),
  effective_ends_at: z.string(),
  extension_count: z.number(),
  reserve_met: z.boolean(),
  primary_image_url: z.string().nullable(),
  my_swipe: swipeDirectionSchema.nullable(),
});

export const lotCardListSchema = z.array(lotCardSchema);

export const lotImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  position: z.number(),
  is_primary: z.boolean(),
  width: z.number().nullable(),
  height: z.number().nullable(),
});

export const lotDetailSchema = lotCardSchema.extend({
  description: z.string().nullable(),
  scheduled_ends_at: z.string(),
  images: z.array(lotImageSchema),
  my_auto_bid_max_minor: z.number().nullable(),
  am_i_leading: z.boolean(),
});

/* ---------------------------------------------------------------- bids --- */

export const bidStatusSchema = z.enum([
  "active",
  "outbid",
  "winning",
  "won",
  "retracted",
  "void",
]);

export const bidSchema = z.object({
  id: z.string(),
  sequence: z.number(),
  amount_minor: z.number(),
  status: bidStatusSchema,
  is_auto: z.boolean(),
  created_at: z.string(),
  bidder_handle: z.string(),
  is_mine: z.boolean(),
});

export const bidListSchema = z.array(bidSchema);

export const bidResultSchema = z.object({
  lot_id: z.string(),
  accepted: z.boolean(),
  is_replay: z.boolean(),
  am_i_leading: z.boolean(),
  current_bid_minor: z.number().nullable(),
  minimum_next_bid_minor: z.number(),
  my_max_minor: z.number().nullable(),
  bid_count: z.number(),
  bid_sequence: z.number(),
  effective_ends_at: z.string(),
  extension_count: z.number(),
  extended: z.boolean(),
  bids: bidListSchema,
});

export const myBidSchema = z.object({
  lot_id: z.string(),
  auction_id: z.string(),
  lot_number: z.number(),
  title: z.string(),
  status: lotStatusSchema,
  current_bid_minor: z.number().nullable(),
  minimum_next_bid_minor: z.number(),
  /** The resume point for a reconnect — see `useLotSubscription`. */
  bid_sequence: z.number(),
  effective_ends_at: z.string(),
  primary_image_url: z.string().nullable(),
  my_max_minor: z.number().nullable(),
  my_highest_bid_minor: z.number().nullable(),
  am_i_leading: z.boolean(),
  is_open: z.boolean(),
});

export const myBidListSchema = z.array(myBidSchema);

/* -------------------------------------------------------------- swipes --- */

export const swipeSchema = z.object({
  lot_id: z.string(),
  direction: swipeDirectionSchema,
  updated_at: z.string(),
});

/* ------------------------------------------------------------ realtime --- */

export const wsTicketSchema = z.object({
  ticket: z.string(),
  expires_in: z.number(),
});

export const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("subscribed"), lot_ids: z.array(z.string()) }),
  z.object({ type: z.literal("unsubscribed"), lot_ids: z.array(z.string()) }),
  z.object({
    type: z.literal("bid"),
    lot_id: z.string(),
    sequence: z.number(),
    amount_minor: z.number(),
    bidder_handle: z.string(),
    bid_count: z.number(),
    is_auto: z.boolean(),
    created_at: z.string(),
  }),
  z.object({
    type: z.literal("lot_extended"),
    lot_id: z.string(),
    effective_ends_at: z.string(),
    extension_count: z.number(),
  }),
  z.object({
    // An admin moved the auction's clock and the cascade moved this lot. Unlike
    // `lot_extended` this can move the close time in *either* direction.
    type: z.literal("lot_rescheduled"),
    lot_id: z.string(),
    scheduled_ends_at: z.string(),
    effective_ends_at: z.string(),
    extension_count: z.number(),
  }),
  z.object({
    type: z.literal("lot_closed"),
    lot_id: z.string(),
    status: lotStatusSchema,
    current_bid_minor: z.number().nullable(),
  }),
  z.object({
    type: z.literal("lot_opened"),
    lot_id: z.string(),
    status: lotStatusSchema,
  }),
  z.object({
    type: z.literal("resync_complete"),
    lot_id: z.string(),
    latest_sequence: z.number(),
    effective_ends_at: z.string(),
    status: lotStatusSchema,
    current_bid_minor: z.number().nullable(),
  }),
  z.object({
    // Built from the same state dict as `resync_complete`, so it carries the
    // lot's current sequence even though it replays nothing.
    type: z.literal("resync_too_far"),
    lot_id: z.string(),
    latest_sequence: z.number(),
  }),
  z.object({ type: z.literal("pong") }),
  z.object({ type: z.literal("ping") }),
  z.object({
    type: z.literal("error"),
    code: z.string(),
    detail: z.string().nullish(),
  }),
]);

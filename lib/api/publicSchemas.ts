import { z } from "zod";
import { auctionStatusSchema, lotStatusSchema } from "@/lib/api/schemas";

/**
 * The anonymous view of the catalogue.
 *
 * Separate schemas from the authenticated ones, mirroring the backend's split
 * and for the same reason: **these shapes have no per-user fields at all** — no
 * `my_swipe`, no `am_i_leading`, no `my_auto_bid_max_minor`, absent rather than
 * null. A component handed one of these cannot render a member affordance,
 * because there is no field to read and no branch to forget.
 *
 * Only `reserve_met` is exposed, never a reserve amount.
 */

export const publicAuctionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  status: auctionStatusSchema,
  starts_at: z.string(),
  ends_at: z.string(),
  currency_code: z.string(),
  lot_count: z.number(),
  deposit_amount_minor: z.number(),
});

export const publicAuctionListSchema = z.array(publicAuctionSchema);

export const publicLotCardSchema = z.object({
  id: z.string(),
  auction_id: z.string(),
  lot_number: z.number(),
  title: z.string(),
  status: lotStatusSchema,
  starting_price_minor: z.number(),
  current_bid_minor: z.number().nullable(),
  /** Server-owned and price-banded. Read it; never compute it. */
  minimum_next_bid_minor: z.number(),
  bid_count: z.number(),
  effective_ends_at: z.string(),
  extension_count: z.number(),
  /** A boolean, and all a visitor may ever see of a reserve. */
  reserve_met: z.boolean(),
  primary_image_url: z.string().nullable(),
});

export const publicLotCardListSchema = z.array(publicLotCardSchema);

export const publicLotImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  position: z.number(),
  is_primary: z.boolean(),
  width: z.number().nullable(),
  height: z.number().nullable(),
});

export const publicLotDetailSchema = publicLotCardSchema.extend({
  description: z.string().nullable(),
  scheduled_ends_at: z.string(),
  images: z.array(publicLotImageSchema),
});

/** What the polling endpoint returns: the three things that move. */
export const publicLotPriceSchema = z.object({
  id: z.string(),
  current_bid_minor: z.number().nullable(),
  bid_count: z.number(),
  effective_ends_at: z.string(),
});

export const publicLotPriceListSchema = z.array(publicLotPriceSchema);

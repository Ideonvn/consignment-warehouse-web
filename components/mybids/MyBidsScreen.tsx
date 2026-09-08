"use client";

import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { BiddingList } from "@/components/mybids/BiddingList";

/**
 * Everything the user has money on.
 *
 * There were three tabs — Bidding, Interested, Passed. The last two listed
 * swipes, and swiping is gone from the product, so the tab bar went with them
 * rather than becoming a single tab pretending to be a choice.
 */
export function MyBidsScreen() {
  return (
    <PhoneColumn className="pb-8">
      <ScreenHeader title="My bids" />
      <BiddingList />
    </PhoneColumn>
  );
}

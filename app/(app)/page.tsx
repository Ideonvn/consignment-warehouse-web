import type { Metadata } from "next";
import { AuctionList } from "@/components/auction/AuctionList";
import { PublicAuctionList } from "@/components/public/PublicAuctionList";
import { ModeSwitch } from "@/components/public/ModeSwitch";

export const metadata: Metadata = {
  title: "Auctions",
  description: "Live consignment auctions — photos, prices and the clock, no account needed to look.",
};

export default function AuctionsPage() {
  return <ModeSwitch member={<AuctionList />} public={<PublicAuctionList />} />;
}

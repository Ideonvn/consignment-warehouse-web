import type { Metadata } from "next";
import { AuctionList } from "@/components/auction/AuctionList";

export const metadata: Metadata = {
  title: "Auctions",
  description: "Live consignment auctions — swipe through the lots.",
};

export default function AuctionsPage() {
  return <AuctionList />;
}

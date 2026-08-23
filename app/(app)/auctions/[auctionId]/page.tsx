import type { Metadata } from "next";
import { AuctionBrowseScreen } from "@/components/lot/AuctionBrowseScreen";

export const metadata: Metadata = {
  title: "The stack",
  description: "Swipe through this auction's lots.",
};

export default async function AuctionStackPage(props: PageProps<"/auctions/[auctionId]">) {
  const { auctionId } = await props.params;
  return <AuctionBrowseScreen auctionId={auctionId} />;
}

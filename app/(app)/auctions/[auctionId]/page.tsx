import type { Metadata } from "next";
import { AuctionStackScreen } from "@/components/lot/AuctionStackScreen";

export const metadata: Metadata = {
  title: "The stack",
  description: "Swipe through this auction's lots.",
};

export default async function AuctionStackPage(props: PageProps<"/auctions/[auctionId]">) {
  const { auctionId } = await props.params;
  return <AuctionStackScreen auctionId={auctionId} />;
}

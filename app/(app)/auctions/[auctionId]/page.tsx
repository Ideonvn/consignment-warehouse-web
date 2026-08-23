import type { Metadata } from "next";
import { getPublicAuction } from "@/lib/api/publicEndpoints";
import { AuctionBrowseScreen } from "@/components/lot/AuctionBrowseScreen";
import { PublicAuctionScreen } from "@/components/public/PublicAuctionScreen";
import { ModeSwitch } from "@/components/public/ModeSwitch";
import { METADATA_REVALIDATE_SECONDS } from "@/lib/public/metadata";

/**
 * Real metadata for a public auction, fetched server-side.
 *
 * A private, draft or non-existent auction all 404 identically, and this returns
 * nothing rather than a title — a page headed with a private auction's name
 * would confirm it exists, which is the one thing the 404 rule is protecting.
 */
export async function generateMetadata(props: PageProps<"/auctions/[auctionId]">): Promise<Metadata> {
  const { auctionId } = await props.params;
  try {
    const auction = await getPublicAuction(auctionId, {
      revalidate: METADATA_REVALIDATE_SECONDS,
    });
    const description =
      auction.description ??
      `${auction.lot_count} ${auction.lot_count === 1 ? "lot" : "lots"} — browse the catalogue.`;
    return {
      title: auction.name,
      description,
      openGraph: {
        type: "website",
        title: auction.name,
        description,
        url: `/auctions/${auction.id}`,
        images: auction.image_url ? [{ url: auction.image_url }] : undefined,
      },
      twitter: { card: "summary_large_image" },
    };
  } catch {
    return {};
  }
}

export default async function AuctionStackPage(props: PageProps<"/auctions/[auctionId]">) {
  const { auctionId } = await props.params;
  return (
    <ModeSwitch
      member={<AuctionBrowseScreen auctionId={auctionId} />}
      public={<PublicAuctionScreen auctionId={auctionId} />}
    />
  );
}

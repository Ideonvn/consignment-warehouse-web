import type { Metadata } from "next";
import { getPublicLot } from "@/lib/api/publicEndpoints";
import { LotDetailScreen } from "@/components/lot/LotDetailScreen";
import { PublicLotScreen } from "@/components/public/PublicLotScreen";
import { ModeSwitch } from "@/components/public/ModeSwitch";
import { METADATA_REVALIDATE_SECONDS, lotPreviewDescription } from "@/lib/public/metadata";

/**
 * The link preview, which is what this feature is for.
 *
 * This business came out of WhatsApp groups, so a pasted link has to show the
 * photograph, the title and the price. That was impossible while every read
 * needed a token; the public endpoint needs none, which is precisely why the
 * server can render it.
 *
 * A private or missing lot returns generic site metadata and lets the page show
 * its not-found state. Nothing here may name a lot that is not public.
 */
export async function generateMetadata(props: PageProps<"/lots/[lotId]">): Promise<Metadata> {
  const { lotId } = await props.params;
  try {
    const lot = await getPublicLot(lotId, { revalidate: METADATA_REVALIDATE_SECONDS });
    const title = `Lot ${lot.lot_number}: ${lot.title}`;
    const description = lotPreviewDescription(lot);
    // Absolute already, straight from the API. `images.unoptimized` means the URL
    // passes through untouched — a relative one would silently produce no
    // preview at all, which nobody notices until a link is shared.
    const image = lot.images.find((row) => row.is_primary)?.url ?? lot.primary_image_url;
    return {
      title,
      description,
      openGraph: {
        type: "article",
        title,
        description,
        url: `/lots/${lot.id}`,
        images: image ? [{ url: image, alt: lot.title }] : undefined,
      },
      twitter: { card: "summary_large_image" },
    };
  } catch {
    return {};
  }
}

export default async function LotDetailPage(props: PageProps<"/lots/[lotId]">) {
  const { lotId } = await props.params;
  return (
    <ModeSwitch
      member={<LotDetailScreen lotId={lotId} />}
      public={<PublicLotScreen lotId={lotId} />}
    />
  );
}

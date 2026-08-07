import type { Metadata } from "next";
import { LotDetailScreen } from "@/components/lot/LotDetailScreen";

export const metadata: Metadata = {
  title: "Lot",
  description: "Photos, price, bid history and your maximum.",
};

export default async function LotDetailPage(props: PageProps<"/lots/[lotId]">) {
  const { lotId } = await props.params;
  return <LotDetailScreen lotId={lotId} />;
}

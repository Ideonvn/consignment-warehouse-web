import type { Metadata } from "next";
import { MyBidsScreen } from "@/components/mybids/MyBidsScreen";

export const metadata: Metadata = {
  title: "My bids",
  description: "Lots you're winning, and lots you've been outbid on.",
};

export default function MyBidsPage() {
  return <MyBidsScreen />;
}

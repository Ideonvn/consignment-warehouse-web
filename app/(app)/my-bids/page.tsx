import type { Metadata } from "next";
import { Suspense } from "react";
import { MyBidsScreen } from "@/components/mybids/MyBidsScreen";

export const metadata: Metadata = {
  title: "My bids",
  description: "Lots you're winning, lots you've been outbid on, and everything you saved.",
};

export default function MyBidsPage() {
  return (
    <Suspense fallback={null}>
      <MyBidsScreen />
    </Suspense>
  );
}

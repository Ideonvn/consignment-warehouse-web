import type { Metadata } from "next";
import { SearchScreen } from "@/components/search/SearchScreen";

export const metadata: Metadata = {
  title: "Search",
  description: "Find a lot by title or lot number, across every auction.",
};

/**
 * Signed-in only, and **deliberately absent from `lib/auth/publicPaths.ts`**.
 * There is no anonymous search endpoint, so an anonymous visitor here should
 * meet the guard and be sent to sign in — never a screen that 401s. The
 * allowlist needs no edit for that; it needs the discipline not to receive one.
 */
export default function SearchPage() {
  return <SearchScreen />;
}

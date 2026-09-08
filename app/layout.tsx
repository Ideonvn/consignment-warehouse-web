import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

/**
 * Absolute URLs for link previews.
 *
 * `openGraph.url` and any relative image are resolved against this. Without it
 * Next falls back to localhost, which produces a preview that works on the
 * developer's machine and nowhere else — invisible until someone shares a link.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://consignment-warehouse.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Consignment Warehouse",
    template: "%s · Consignment Warehouse",
  },
  description: "Bid and win — live consignment auctions.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Warehouse", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  // No `themeColor` here on purpose. A static export can only vary by media
  // query, which follows the OS — an explicit Light choice on a dark OS would
  // keep a black status bar. `ThemeProvider` owns a single `theme-color` tag
  // and sets it from the resolved theme instead.
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // `suppressHydrationWarning` on <html> is required: the pre-paint script sets
  // `data-theme` on it before React hydrates.
  // No `h-full` on <html>: percentage heights resolve against the *large*
  // viewport, which on mobile assumes the URL bar has collapsed — a viewport the
  // user may never actually have. `dvh` measures what is visible right now.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-bg text-text">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:border focus:border-accent-edge focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-accent-ink"
        >
          Skip to content
        </a>
        <Providers>
          <div id="main">{children}</div>
        </Providers>
      </body>
    </html>
  );
}

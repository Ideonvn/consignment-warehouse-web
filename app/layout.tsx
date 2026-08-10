import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Consignment Warehouse",
    template: "%s · Consignment Warehouse",
  },
  description: "Swipe, bid and win — live consignment auctions.",
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
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full bg-bg text-text">
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

import type { NextConfig } from "next";

/**
 * Private (RFC 1918) ranges, so the dev server can be opened from a phone on the
 * same network without pinning one machine's DHCP address.
 *
 * Next matches these against the request's **hostname only** — ports are
 * stripped, so `1.2.3.4:3000` would never match anything. Each `*` matches one
 * dot-separated segment, which happens to work on IPv4 literals.
 *
 * Dev only: it widens which origins may pull dev assets and HMR. Fine on a home
 * or office LAN; on untrusted wifi, narrow it to your own address.
 */
const PRIVATE_NETWORK_ORIGINS = [
  "192.168.*.*",
  "10.*.*.*",
  // 172.16.0.0/12 spans 172.16 through 172.31 — "172.16.*.*" alone would miss
  // the rest, including the 172.17/172.18 bridges Docker hands out.
  ...Array.from({ length: 16 }, (_, index) => `172.${16 + index}.*.*`),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: PRIVATE_NETWORK_ORIGINS,
  images: {
    // Lot photos come from whichever host the backend serves media from. See NOTES.md.
    unoptimized: true,
  },
};

export default nextConfig;

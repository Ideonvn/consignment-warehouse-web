import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Lot photos come from whichever host the backend serves media from. See NOTES.md.
    unoptimized: true,
  },
};

export default nextConfig;

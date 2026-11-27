import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets several dev servers or builds run side by side without sharing a build directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The speech route opens a WebSocket with `ws`; bundling it breaks its optional native add-ons.
  serverExternalPackages: ["ws"],
};

export default nextConfig;

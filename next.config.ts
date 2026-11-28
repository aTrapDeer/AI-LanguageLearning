import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets several dev servers or builds run side by side without sharing a build directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // `ws` (used by the Realtime speech session behind /api/tts) must be loaded by Node itself: when
  // it is bundled, its optional native helpers are stubbed out and sending a frame throws.
  serverExternalPackages: ["ws"],
};

export default nextConfig;

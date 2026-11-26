import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets several dev servers or builds run side by side without sharing a build directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;

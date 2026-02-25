import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Set output file tracing root to this directory to fix multiple lockfiles warning
  outputFileTracingRoot: __dirname,
};

export default nextConfig;

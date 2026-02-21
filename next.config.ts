import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use standalone for server-side rendering (works with Tauri bundled server)
  output: "standalone",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Disable experimental features that might conflict
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;

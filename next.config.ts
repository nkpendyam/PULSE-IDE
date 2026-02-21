import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use static export for Tauri desktop app
  // API routes will be handled by Tauri Rust backend
  output: "export",
  images: {
    unoptimized: true, // Required for static export
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  trailingSlash: true, // Better compatibility with static hosting
};

export default nextConfig;

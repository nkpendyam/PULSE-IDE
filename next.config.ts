import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for Tauri desktop app
  output: "export",
  // Output to 'out' folder for Tauri
  distDir: "out",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  trailingSlash: true,
};

export default nextConfig;

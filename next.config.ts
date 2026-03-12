import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
  },
  turbopack: {},
  // Optimize for production builds
  compress: true,
  poweredByHeader: false,
  // Static export requires unoptimized images (no server to resize)
  images: {
    unoptimized: true,
  },
  // Webpack configuration for Monaco Editor
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // Monaco Editor worker configuration
    config.module.rules.push({
      test: /\.worker\.js$/,
      use: { loader: 'worker-loader' },
    });

    return config;
  },
};

export default nextConfig;

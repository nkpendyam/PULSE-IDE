import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
    turbopack: {
      root: __dirname,
    },
  },
  // Optimize for production builds
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  // Enable image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
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

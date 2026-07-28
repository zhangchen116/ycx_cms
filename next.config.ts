import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/api/media/serve/:path*",
      },
    ];
  },
};

export default nextConfig;

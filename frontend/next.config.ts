import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/market/:path*",
        destination: "http://localhost:5000/api/market/:path*",
      },
      {
        source: "/api/market/discover",
        destination: "http://localhost:5000/api/market/discovery",
      },
      {
        source: "/api/market/gainers-losers",
        destination: "http://localhost:5000/api/market/gainers-losers",
      },
    ];
  },
};

export default nextConfig;

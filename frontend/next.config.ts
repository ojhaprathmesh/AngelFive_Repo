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
      {
        source: "/api/dsfm/:path*",
        destination: "http://localhost:5000/api/dsfm/:path*",
      },
      {
        source: "/api/ml/:path*",
        destination: "http://localhost:8000/:path*",
      },
    ];
  },
};

export default nextConfig;

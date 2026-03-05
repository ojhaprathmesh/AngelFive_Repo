import type { NextConfig } from "next";

const URL_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const nextConfig: NextConfig = {
    async rewrites() {
        return [
            {
                source: "/api/market/:path*",
                destination: `${URL_BASE}/api/market/:path*`,
            },
            {
                source: "/api/market/discover",
                destination: `${URL_BASE}/api/market/discovery`,
            },
            {
                source: "/api/market/gainers-losers",
                destination: `${URL_BASE}/api/market/gainers-losers`,
            },
            {
                source: "/api/dsfm/:path*",
                destination: `${URL_BASE}/api/dsfm/:path*`,
            },
            {
                source: "/api/watchlists/:path*",
                destination: `${URL_BASE}/api/watchlists/:path*`,
            },
            {
                source: "/api/auth/:path*",
                destination: `${URL_BASE}/api/auth/:path*`,
            },
            {
                source: "/api/ml/:path*",
                destination: `${process.env.NEXT_PUBLIC_ML_SERVICE_URL || "http://localhost:8000"}/:path*`,
            },
        ];
    },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Limit CPU usage to prevent memory exhaustion and OS crashes during build
    cpus: 1,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

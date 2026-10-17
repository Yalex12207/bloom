import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
  async headers() {
    return [{
      source: "/audio/bloom-study-v1.wav",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }];
  },
};

export default nextConfig;

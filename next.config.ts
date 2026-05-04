import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "*.ufs.sh" },
    ],
  },
  experimental: {
    serverActions: {
      // Default is 1mb. Wall threads & bulletins with rich-text + many
      // image references can legitimately get larger; cap at 10mb so
      // people writing long AAR-style posts don't hit a wall, while
      // still rejecting absurd payloads (typically base64-pasted images).
      bodySizeLimit: "10mb",
    },
  },
};

export default config;

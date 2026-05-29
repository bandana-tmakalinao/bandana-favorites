import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the file-tracing root to this project (a stray parent lockfile otherwise confuses Next).
  outputFileTracingRoot: here,
  // Placeholder seed images use keyless throwaway dev mocks (loremflickr/picsum). Real photos are
  // served locally in dev (/uploads) and from R2 in production. NOTE: Unsplash is deliberately NOT
  // allowlisted — its API license carries a non-compete clause (see docs/data-sourcing-research.md).
  // The licensed placeholder path is Pexels ("Photos provided by Pexels" credit required).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "loremflickr.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "**.r2.dev" },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-only "N" badge sits on top of the phone bottom bar and blocks taps.
  devIndicators: false,
  // Document uploads are posted through server actions: allow a little over the file limit (see DOCUMENT_MAX_MB).
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  // Lets the dev server accept requests through the phone tunnel (npm run tunnel).
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;

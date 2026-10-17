import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
import path from "node:path";

// Phones on the same network open the dev server by this machine's LAN IP (e.g. 192.168.2.2).
// Next.js blocks dev scripts/HMR for hosts it doesn't know, so list every local IPv4 address.
const lanHosts = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal)
  .map((n) => n!.address);

const nextConfig: NextConfig = {
  // Explicit workspace root silences the multi-lockfile warning when nested in HMRSv3.0
  turbopack: {
    root: path.resolve(process.cwd(), ".."),
  },
  // The dev-only "N" badge sits on top of the phone bottom bar and blocks taps.
  devIndicators: false,
  // Document uploads are posted through server actions: allow a little over the file limit (see DOCUMENT_MAX_MB).
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  // Lets the dev server accept requests through the phone tunnel (npm run tunnel) and from phones on the LAN.
  allowedDevOrigins: ["*.trycloudflare.com", ...lanHosts],
  // Enterprise production security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;

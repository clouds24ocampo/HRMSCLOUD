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
  // pdfkit reads its font files from disk at runtime: keep it out of the bundle.
  serverExternalPackages: ["pdfkit"],
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
          // Browsers only honor this over HTTPS, so plain-HTTP development is unaffected.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Report-only: browsers log violations in the console but block nothing. Check the console on every page
          // for a while, tighten the sources, then rename the header to Content-Security-Policy to enforce it.
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://cdn.21st.dev https://*.tile.openstreetmap.org",
              "media-src 'self' blob:",
              "connect-src 'self' ws: wss:",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'self'",
            ].join("; "),
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;

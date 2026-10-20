// Server-side evidence about the device behind a request. The user agent can be faked, so this is a record, not a gate.
import { headers } from "next/headers";
import { config } from "@/lib/config";

export function deviceOf(ua: string): "PHONE" | "TABLET" | "DESKTOP" {
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "TABLET";
  if (/Android|iPhone|iPod|Mobile/i.test(ua)) return "PHONE";
  return "DESKTOP";
}

export async function requestEvidence() {
  const h = await headers();
  const ua = (h.get("user-agent") ?? "").slice(0, 400);
  // Behind a proxy or tunnel the client is the first address in x-forwarded-for.
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64) || null;
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3300";
  // APP_URL wins when set, so links shown on a computer at localhost still open on a phone (LAN address or tunnel).
  return { userAgent: ua || null, ipAddress: ip, device: deviceOf(ua), origin: config.appUrl || `${proto}://${host}` };
}

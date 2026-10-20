import { prisma } from "@/lib/prisma";

// Liveness/readiness probe for Docker and uptime monitors. Public by design (the proxy skips /api) and returns status only.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`select 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}

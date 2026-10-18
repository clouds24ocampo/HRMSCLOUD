import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Reuse one client across dev hot-reloads, but refresh if new models were generated.
const g = globalThis as unknown as { prisma?: PrismaClient };

// Invalidate stale in-memory client if schema additions (incentives, contracts) occurred during dev
if (g.prisma && (!("incentive" in g.prisma) || !("contract" in g.prisma))) {
  g.prisma = undefined;
}

export const prisma =
  g.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

if (process.env.NODE_ENV !== "production") g.prisma = prisma;

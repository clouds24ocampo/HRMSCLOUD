// Automatic semi-monthly payroll: the cut-offs exist without anyone creating them, and their numbers follow the DTR as it fills in.
// Runs when HR opens Home or Payroll (at most once an hour per period), so there is no background job to keep alive.
// ponytail: on-view refresh; move to a scheduled job if headcount makes a recalculation slow.
import { prisma } from "@/lib/prisma";
import { cutoffFor, previousCutoff } from "@/lib/cutoffs";
import { calculatePeriod } from "@/lib/payroll-data";
import type { Actor } from "@/lib/scope";
import { dbDate } from "@/lib/time";

const STALE_MS = 60 * 60 * 1000;

// Creates the current and the previous cut-off if they do not exist. Skips any that would overlap a period HR made by hand,
// so the same day is never paid twice. A lock per organization stops two page loads from creating the same period.
export async function ensureCutoffs(organizationId: string, today: string, actorId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cutoffs:${organizationId}`}))`;
    for (const c of [previousCutoff(today), cutoffFor(today)]) {
      const overlap = await tx.payrollPeriod.findFirst({
        where: { organizationId, kind: "REGULAR", startDate: { lte: dbDate(c.end) }, endDate: { gte: dbDate(c.start) } },
        select: { id: true },
      });
      if (overlap) continue;
      await tx.payrollPeriod.create({
        data: { organizationId, name: c.name, startDate: dbDate(c.start), endDate: dbDate(c.end), payDate: dbDate(c.payDate), periodsPerMonth: 2, createdById: actorId },
      });
    }
  });
}

// Recalculates cut-offs nobody has calculated by hand yet, when their numbers are over an hour old.
// Approved and finalized payrolls, and any a person calculated, are never touched.
export async function refreshLivePayroll(me: Actor, today: string) {
  const due = await prisma.payrollPeriod.findMany({
    where: {
      organizationId: me.organizationId, kind: "REGULAR", status: { in: ["DRAFT", "CALCULATED"] }, calculatedById: null,
      startDate: { lte: dbDate(today) },
      OR: [{ calculatedAt: null }, { calculatedAt: { lt: new Date(Date.now() - STALE_MS) } }],
    },
    select: { id: true },
  });
  for (const p of due) {
    // Best effort: two page loads at once may race on the same period; the loser simply waits for the next view.
    try {
      await calculatePeriod(me, p.id, { auto: true });
    } catch (e) {
      console.error("[payroll] live recalculation failed", p.id, e);
    }
  }
}

export async function autoPayroll(me: Actor, today: string) {
  const s = await prisma.orgSettings.findUnique({ where: { organizationId: me.organizationId }, select: { autoCutoffs: true } });
  if (s && !s.autoCutoffs) return; // the organization runs its own pay periods by hand
  await ensureCutoffs(me.organizationId, today, me.id);
  await refreshLivePayroll(me, today);
}

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { STAGE_LABEL } from "@/lib/stages";
import { applicantMatch } from "@/lib/applicant-search";

// The Recruitment search bar: finds people by name, email or applicant number. HR and Super Admin only (same rule as every
// Recruitment page). One entry per person, even when they applied for several positions. Hired people are found too.
export async function GET(req: Request) {
  const me = await requireUser("/recruitment");
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return Response.json({ people: [] });
  const rows = await prisma.applicant.findMany({
    where: {
      organizationId: me.organizationId,
      ...applicantMatch(q),
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, name: true, stage: true, profileId: true, profile: { select: { applicantNo: true } }, job: { select: { title: true } } },
  });
  const people = new Map<string, { id: string; name: string; no: string | null; jobs: string[]; stage: string }>();
  for (const a of rows) {
    const key = a.profileId ?? a.id;
    const p = people.get(key);
    if (p) { if (!p.jobs.includes(a.job.title)) p.jobs.push(a.job.title); continue; }
    people.set(key, { id: a.id, name: a.name, no: a.profile?.applicantNo ?? null, jobs: [a.job.title], stage: STAGE_LABEL[a.stage] });
  }
  return Response.json({ people: [...people.values()].slice(0, 8) }, { headers: { "Cache-Control": "private, no-store" } });
}

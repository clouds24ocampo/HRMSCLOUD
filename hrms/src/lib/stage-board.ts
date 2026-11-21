// The people in one stage of the hiring road, each with how complete they are, read in a few queries for the whole stage
// (not one set per person), so the stage tabs stay fast with hundreds of applicants.
import { prisma } from "@/lib/prisma";
import { applicantMatch } from "@/lib/applicant-search";
import { buildChecklist } from "@/lib/requirements";
import { buildPipeline, type ContractState } from "@/lib/hiring-pipeline";
import { stageProgress, type BoardStage, type StageProgress } from "@/lib/stage-progress";

export type BoardRow = {
  id: string; name: string; email: string | null; jobId: string; jobTitle: string; applicantNo: string | null; hasAccount: boolean;
  since: Date; interviewAt: Date | null;
  progress: StageProgress; overall: number; // overall: share of the six steps before hiring that are done
};
export type HiredRow = { id: string; name: string; jobId: string; jobTitle: string; applicantNo: string | null; employeeId: string | null; employeeNo: string | null; hiredOn: Date | null; type: string };

export async function stageCounts(organizationId: string) {
  const g = await prisma.applicant.groupBy({ by: ["stage"], where: { organizationId }, _count: { _all: true } });
  return Object.fromEntries(g.map((x) => [x.stage, x._count._all])) as Record<string, number>;
}

export async function loadBoard(organizationId: string, stage: BoardStage, opts: { q?: string; jobId?: string } = {}): Promise<BoardRow[]> {
  const apps = await prisma.applicant.findMany({
    where: { organizationId, stage, ...applicantMatch(opts.q ?? ""), ...(opts.jobId ? { jobId: opts.jobId } : {}) },
    orderBy: { createdAt: "asc" },
    take: 500,
    include: {
      job: { select: { id: true, title: true } },
      profile: { select: { id: true, applicantNo: true, resumeKey: true, idKey: true, pds: { select: { submittedAt: true } }, documents: { where: { archivedAt: null }, select: { id: true, title: true, fileName: true, version: true, createdAt: true } } } },
      attempts: { where: { submittedAt: { not: null } }, select: { examId: true } },
      offerContracts: { where: { status: { not: "VOID" } }, orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
      notes: { where: { stage }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  if (apps.length === 0) return [];

  const [exams, policies] = await Promise.all([
    prisma.exam.findMany({ where: { organizationId, active: true, questions: { some: {} } }, select: { id: true, jobId: true } }),
    prisma.policyDocument.findMany({ where: { organizationId, archivedAt: null, requiresSignature: true }, select: { id: true } }),
  ]);
  const policyIds = policies.map((p) => p.id);
  const profileIds = apps.map((a) => a.profile?.id).filter((x): x is string => !!x);
  const sigs = profileIds.length ? await prisma.applicantPolicySignature.findMany({ where: { profileId: { in: profileIds }, policyId: { in: policyIds } }, select: { profileId: true } }) : [];
  const signedBy = new Map<string, number>();
  for (const s of sigs) signedBy.set(s.profileId, (signedBy.get(s.profileId) ?? 0) + 1);
  const now = new Date();

  return apps.map((a) => {
    const need = exams.filter((e) => e.jobId === null || e.jobId === a.jobId);
    const handedIn = new Set(a.attempts.map((t) => t.examId));
    const checklist = a.profile ? buildChecklist(a.profile.documents, !!a.profile.resumeKey, !!a.profile.pds?.submittedAt) : null;
    const contractStatus = a.offerContracts[0]?.status;
    const contract: ContractState = contractStatus === "SIGNED" ? "SIGNED" : contractStatus === "ISSUED" ? "ISSUED" : "NONE";
    const input = {
      hasAccount: !!a.profile, docsUploaded: !!a.profile?.resumeKey && !!a.profile?.idKey,
      exams: { required: need.length, done: need.filter((e) => handedIn.has(e.id)).length },
      requirements: checklist ? { done: checklist.done, total: checklist.total } : null,
      policies: { total: policyIds.length, signed: a.profile ? (signedBy.get(a.profile.id) ?? 0) : 0 },
      contract,
    };
    const pipeline = buildPipeline({ ...input, stage: a.stage });
    return {
      id: a.id, name: a.name, email: a.email, jobId: a.job.id, jobTitle: a.job.title, applicantNo: a.profile?.applicantNo ?? null, hasAccount: !!a.profile,
      since: a.notes[0]?.createdAt ?? a.createdAt, interviewAt: a.interviewAt,
      progress: stageProgress({ ...input, stage, interviewAt: a.interviewAt, now }),
      overall: Math.round((pipeline.steps.slice(0, 6).filter((s) => s.done).length / 6) * 100),
    };
  });
}

export async function loadHired(organizationId: string, opts: { q?: string; jobId?: string } = {}): Promise<HiredRow[]> {
  const apps = await prisma.applicant.findMany({
    where: { organizationId, stage: "HIRED", ...applicantMatch(opts.q ?? ""), ...(opts.jobId ? { jobId: opts.jobId } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 500,
    include: { job: { select: { id: true, title: true } }, profile: { select: { applicantNo: true } }, employee: { select: { id: true, employeeNo: true, hireDate: true, user: { select: { role: { select: { name: true } } } } } } },
  });
  return apps.map((a) => ({
    id: a.id, name: a.name, jobId: a.job.id, jobTitle: a.job.title, applicantNo: a.profile?.applicantNo ?? null,
    employeeId: a.employee?.id ?? null, employeeNo: a.employee?.employeeNo ?? null, hiredOn: a.employee?.hireDate ?? null, type: a.employee?.user?.role.name ?? "Employee",
  }));
}

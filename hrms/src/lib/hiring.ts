// The hiring road for one application, read from the database: account, exams, interview, requirements, orientation, contract.
// Used by HR's applicant card, the applicant's portal and the hire action, so all three always agree on what is done.
import { prisma } from "@/lib/prisma";
import { examsForJob } from "@/lib/applicants";
import { buildChecklist } from "@/lib/requirements";
import { requiredPolicies } from "@/lib/orientation";
import { buildPipeline, isEngagement, type ContractState, type Engagement } from "@/lib/hiring-pipeline";

export async function hiringState(organizationId: string, applicantId: string) {
  const a = await prisma.applicant.findFirst({
    where: { id: applicantId, organizationId },
    include: {
      job: { select: { id: true, title: true, department: { select: { name: true } } } },
      profile: { include: { documents: { where: { archivedAt: null } }, pds: { select: { submittedAt: true } } } },
      attempts: { where: { submittedAt: { not: null } }, select: { examId: true } },
      offerContracts: { where: { status: { not: "VOID" } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!a) return null;
  const exams = await examsForJob(organizationId, a.jobId);
  const handedIn = new Set(a.attempts.map((t) => t.examId));
  const checklist = a.profile ? buildChecklist(a.profile.documents, !!a.profile.resumeKey, !!a.profile.pds?.submittedAt) : null;
  const policies = a.profile
    ? await requiredPolicies(organizationId, a.profile.id)
    : Array.from({ length: await prisma.policyDocument.count({ where: { organizationId, archivedAt: null, requiresSignature: true } }) }, () => ({ signed: false }));
  const contract = a.offerContracts[0] ?? null;
  const contractState: ContractState = contract?.status === "SIGNED" ? "SIGNED" : contract?.status === "ISSUED" ? "ISSUED" : "NONE";
  const pipeline = buildPipeline({
    hasAccount: !!a.profile,
    exams: { required: exams.length, done: exams.filter((e) => handedIn.has(e.id)).length },
    stage: a.stage,
    requirements: checklist ? { done: checklist.done, total: checklist.total } : null,
    policies: { total: policies.length, signed: policies.filter((p) => p.signed).length },
    contract: contractState,
  });
  const engagement: Engagement | null = contract && isEngagement(contract.engagement) ? contract.engagement : null;
  return { applicant: a, contract, engagement, pipeline };
}

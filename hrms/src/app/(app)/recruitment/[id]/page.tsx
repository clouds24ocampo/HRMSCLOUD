import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { dayKey } from "@/lib/time";
import { passed, KIND_LABEL } from "@/lib/exams";
import { examsForJob } from "@/lib/applicants";
import { buildChecklist } from "@/lib/requirements";
import { RoleInfo } from "@/components/RoleInfo";
import { LEVEL_LABEL } from "@/lib/defaults";
import { Badge, Card, PageHeader } from "@/components/ui";
import { AddApplicantForm, ApplicantCard, JobStatusButton } from "../RecruitmentForms";

const STAGES = [
  ["APPLIED", "Applied"],
  ["SCREENING", "Screening"],
  ["INTERVIEW", "Interview"],
  ["REQUIREMENTS", "For requirements"],
  ["OFFER", "Offer"],
  ["HIRED", "Hired"],
  ["REJECTED", "Rejected"],
] as const;

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser("/recruitment");
  const settings = await getOrgSettings(me.organizationId);
  const job = await prisma.jobPosting.findFirst({
    where: { id, organizationId: me.organizationId },
    include: {
      department: { select: { name: true } },
      applicants: { orderBy: { createdAt: "asc" }, include: { notes: { orderBy: { createdAt: "desc" }, take: 6 }, profile: { include: { documents: { where: { archivedAt: null }, orderBy: { createdAt: "desc" } }, policySignatures: { select: { policyId: true } } } }, attempts: { include: { exam: { select: { title: true, kind: true, passingPct: true } } }, orderBy: { startedAt: "asc" } } } },
    },
  });
  if (!job) notFound();

  const required = await examsForJob(me.organizationId, job.id);
  const activePolicies = new Set((await prisma.policyDocument.findMany({ where: { organizationId: me.organizationId, archivedAt: null, requiresSignature: true }, select: { id: true } })).map((p) => p.id));
  const localInput = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: settings.timezone, dateStyle: "short", timeStyle: "short" }).format(d).replace(" ", "T");
  const [departments, positions, managers, shifts] = await Promise.all([
    prisma.department.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.position.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, select: { id: true, title: true, level: true }, orderBy: { title: "asc" } }),
    prisma.employee.findMany({ where: { organizationId: me.organizationId, status: { not: "SEPARATED" } }, select: { id: true, firstName: true, lastName: true, employeeNo: true }, orderBy: { lastName: "asc" } }),
    prisma.shiftTemplate.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, select: { id: true, name: true, startTime: true, endTime: true }, orderBy: { startTime: "asc" } }),
  ]);
  const when = new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, dateStyle: "medium", timeStyle: "short" });
  const today = dayKey(new Date(), settings.timezone);
  const hired = job.applicants.filter((a) => a.stage === "HIRED").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/recruitment" className="text-sm font-medium text-muted hover:text-ink">← All jobs</Link>
      <PageHeader
        title={job.title}
        subtitle={`${job.department?.name ?? "Any department"} · ${hired} of ${job.openings} filled`}
        action={<div className="flex items-center gap-2"><Badge tone={job.status === "OPEN" ? "success" : "neutral"}>{job.status === "OPEN" ? "Open" : "Closed"}</Badge><JobStatusButton id={job.id} open={job.status === "OPEN"} /></div>}
      />
      {(job.description || job.duties) && <Card><RoleInfo description={job.description} descriptionTl={job.descriptionTl} duties={job.duties} dutiesTl={job.dutiesTl} /></Card>}
      {required.length === 0 && (
        <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          No exam is set for this position, so applicants go straight to uploading their documents. <Link href="/recruitment/exams" className="font-semibold text-brand hover:underline">Create an exam</Link> and choose this position.
        </p>
      )}

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Add an applicant</h2>
        <AddApplicantForm jobId={job.id} />
      </Card>

      <div className="space-y-6">
        {STAGES.map(([stage, label]) => {
          const list = job.applicants.filter((a) => a.stage === stage);
          if (list.length === 0 && (stage === "HIRED" || stage === "REJECTED")) return null;
          return (
            <section key={stage} aria-label={label}>
              <h2 className="mb-2 flex items-center gap-2 font-semibold">{label} <Badge>{list.length}</Badge></h2>
              {list.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">No one here.</p>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {list.map((a) => (
                    <ApplicantCard
                      key={a.id}
                      a={{
                        id: a.id, name: a.name, email: a.email, phone: a.phone, source: a.source, stage: a.stage,
                        interviewAt: a.interviewAt ? when.format(a.interviewAt) : null,
                        notes: a.notes.map((n) => ({ id: n.id, text: n.text, at: when.format(n.createdAt) })),
                        portal: a.profile ? {
                          applicantNo: a.profile.applicantNo, hasResume: !!a.profile.resumeKey, hasId: !!a.profile.idKey,
                          // Every exam this job needs, so HR also sees the ones not started yet.
                          exams: required.map((e) => {
                            const t = a.attempts.find((x) => x.examId === e.id);
                            const pct = t?.maxScore ? Math.round(((t.score ?? 0) / t.maxScore) * 100) : 0;
                            const bd = (t?.breakdown ?? {}) as Record<string, { score: number; max: number }>;
                            return {
                              title: `${e.title} (${KIND_LABEL[e.kind]})`, kind: e.kind, attemptId: t?.submittedAt ? t.id : null,
                              status: !t ? "Not started" : t.submittedAt ? `${t.score}/${t.maxScore} (${pct}%)` : "In progress",
                              passed: t?.submittedAt && t.exam.passingPct != null ? passed(pct, t.exam.passingPct) : null,
                              traits: Object.entries(bd).map(([k, v]) => `${k} ${v.max ? Math.round((v.score / v.max) * 100) : 0}%`).join(" · "),
                            };
                          }),
                          orientation: { at: a.orientationAt ? when.format(a.orientationAt) : null, input: a.orientationAt ? localInput(a.orientationAt) : "", signed: a.profile.policySignatures.filter((x) => activePolicies.has(x.policyId)).length, total: activePolicies.size },
                          requirements: ["REQUIREMENTS", "OFFER", "HIRED"].includes(a.stage) ? (() => {
                            const c = buildChecklist(a.profile!.documents, !!a.profile!.resumeKey);
                            return { done: c.done, total: c.total, items: c.items.map((i) => ({ title: i.title, required: i.required, docId: i.doc?.id ?? null, auto: i.auto })) };
                          })() : undefined,
                        } : undefined,
                      }}
                      today={today}
                      defaultDepartment={job.departmentId ?? ""}
                      defaultPosition={job.positionId ?? ""}
                      departments={departments.map((d) => ({ id: d.id, label: d.name }))}
                      positions={positions.map((p) => ({ id: p.id, label: `${p.title} (${LEVEL_LABEL[p.level]})` }))}
                      managers={managers.map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName} · ${m.employeeNo}` }))}
                      shifts={shifts.map((s) => ({ id: s.id, label: `${s.name} (${s.startTime}–${s.endTime})` }))}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

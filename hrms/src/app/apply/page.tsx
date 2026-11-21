import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { requireUser } from "@/lib/auth";
import { examsForJob, openJobs } from "@/lib/applicants";
import { KIND_LABEL } from "@/lib/exams";
import { Badge, Card, EmptyState } from "@/components/ui";
import { ApplyPicker, RequirementRow, UploadForm } from "./ApplyForms";
import { canUploadRequirements } from "@/lib/stages";
import { requirementChecklist } from "@/lib/requirements";
import { orientationOpen, requiredPolicies } from "@/lib/orientation";
import { getOrgSettings } from "@/lib/settings";
import { hiringState } from "@/lib/hiring";
import { ENGAGEMENT_LABEL, isEngagement } from "@/lib/hiring-pipeline";
import { HiringJourney } from "@/components/HiringJourney";
import { SignPolicyForm } from "@/app/(app)/policies/PolicyForms";
import { signApplicantContract } from "./actions";

const STAGE: Record<string, [string, "neutral" | "brand" | "success" | "warning" | "danger"]> = {
  APPLIED: ["Application started", "neutral"],
  SCREENING: ["With HR for review", "brand"],
  INTERVIEW: ["Interview stage", "brand"],
  REQUIREMENTS: ["Submit your requirements", "warning"],
  OFFER: ["Orientation and contract", "success"],
  HIRED: ["Hired", "success"],
  REJECTED: ["Not selected", "danger"],
};

export default async function ApplyPage() {
  const me = await requireUser("/apply");
  const profile = await prisma.applicantProfile.findUniqueOrThrow({ where: { userId: me.id } });
  const [apps, jobs] = await Promise.all([
    prisma.applicant.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: "desc" }, include: { job: { select: { id: true, title: true } }, attempts: { select: { examId: true, submittedAt: true } } } }),
    openJobs(me.organizationId),
  ]);
  const withExams = await Promise.all(apps.map(async (a) => ({ a, exams: await examsForJob(me.organizationId, a.jobId) })));
  const applied = new Set(apps.map((a) => a.jobId));
  const open = jobs.filter((j) => !applied.has(j.id));
  const docsDone = !!profile.resumeKey && !!profile.idKey;
  const reqOpen = canUploadRequirements(apps.map((a) => a.stage));
  const live = apps.some((a) => a.stage !== "REJECTED"); // steps 3 and 4 only matter while an application is alive
  const checklist = live ? await requirementChecklist(profile.id) : null;
  const tz = (await getOrgSettings(me.organizationId)).timezone;
  const scheduled = apps.filter((a) => a.orientationAt && a.stage !== "REJECTED").map((a) => a.orientationAt!).sort((x, y) => x.getTime() - y.getTime());
  const policies = scheduled.length ? await requiredPolicies(me.organizationId, profile.id) : [];
  const signingOpen = orientationOpen(scheduled, new Date(), tz);
  const when = new Intl.DateTimeFormat("en-US", { timeZone: tz, dateStyle: "full", timeStyle: "short" });
  // The road to being hired, for the application that is furthest along; and the contract(s) HR sent.
  const RANK = ["APPLIED", "SCREENING", "INTERVIEW", "REQUIREMENTS", "OFFER"];
  const lead = [...apps].filter((a) => RANK.includes(a.stage)).sort((x, y) => RANK.indexOf(y.stage) - RANK.indexOf(x.stage))[0];
  const journey = lead ? await hiringState(me.organizationId, lead.id) : null;
  const contracts = await prisma.applicantContract.findMany({ where: { organizationId: me.organizationId, applicant: { profileId: profile.id }, status: { not: "VOID" } }, orderBy: { createdAt: "desc" }, include: { applicant: { select: { job: { select: { title: true } } } } } });
  const contractStage = apps.some((a) => ["REQUIREMENTS", "OFFER"].includes(a.stage));

  return (
    <>
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <p className="text-sm text-muted">Welcome, {me.name.split(" ")[0]}</p>
        <p className="mt-1 text-sm text-muted">Your applicant number</p>
        <p className="font-mono text-2xl font-bold tracking-wider">{profile.applicantNo}</p>
        <p className="mt-1 text-sm text-muted">Keep it. If you are hired, it becomes your employee number.</p>
      </section>

      {journey && lead && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Your hiring journey</h2>
            <span className="text-sm text-muted">{lead.job.title}</span>
          </div>
          <p className="mt-1 mb-3 text-sm text-muted">From your exams to your first day. We update each step as it is done.{journey.engagement && ` You will join as ${ENGAGEMENT_LABEL[journey.engagement].toLowerCase() === "employee" ? "an employee" : "a subcontractor"}.`}</p>
          <HiringJourney steps={journey.pipeline.steps} current={journey.pipeline.current} />
        </Card>
      )}

      {withExams.length > 0 && (
        <Card className={docsDone ? "" : "border-brand"}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Step 1: Upload your resume and valid ID</h2>
            {docsDone ? <Badge tone="success">Received</Badge> : <Badge tone="warning">Required before the exams</Badge>}
          </div>
          {!docsDone && <p className="mt-1 text-sm text-muted">The exams unlock as soon as both files are uploaded.</p>}
          {(profile.resumeKey || profile.idKey) && (
            <p className="mt-3 flex flex-wrap gap-4 text-sm">
              {profile.resumeKey && <a href="/apply/file/resume" target="_blank" className="font-semibold text-brand hover:underline">View my resume</a>}
              {profile.idKey && <a href="/apply/file/id" target="_blank" className="font-semibold text-brand hover:underline">View my valid ID</a>}
            </p>
          )}
          <div className="mt-3"><UploadForm hasResume={!!profile.resumeKey} hasId={!!profile.idKey} maxMb={config.documentMaxMb} /></div>
        </Card>
      )}

      <section aria-label="My applications" className="space-y-3">
        <h2 className="text-lg font-semibold">{withExams.length > 0 ? "Step 2: Take the exams" : "My applications"}</h2>
        {withExams.length === 0 ? (
          <EmptyState title="You have not applied yet" hint="Tick one or more positions below, then press Apply." />
        ) : (
          withExams.map(({ a, exams }) => {
            const [label, tone] = STAGE[a.stage] ?? ["", "neutral"];
            const taken = new Set(a.attempts.filter((t) => t.submittedAt).map((t) => t.examId));
            const closed = a.stage === "HIRED" || a.stage === "REJECTED";
            return (
              <Card key={a.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{a.job.title}</h3>
                  <Badge tone={tone}>{label}</Badge>
                </div>
                <ol className="mt-4 space-y-2 text-sm">
                  {exams.map((e, i) => {
                    const isDone = taken.has(e.id);
                    const started = a.attempts.some((t) => t.examId === e.id);
                    const needDocs = !isDone && !docsDone;
                    const locked = !isDone && !exams.slice(0, i).every((p) => taken.has(p.id));
                    return (
                      <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                        <span><span className="font-medium">{e.title}</span> <span className="text-muted">· {KIND_LABEL[e.kind]} · {e._count.questions} questions · {e.timeLimitMin} min</span></span>
                        {isDone ? <Badge tone="success">Done</Badge>
                          : needDocs ? <Badge tone="warning">Upload documents first</Badge>
                          : closed || locked ? <Badge>{closed ? "Closed" : "Locked"}</Badge>
                          : <Link href={`/apply/exam/${a.id}/${e.id}`} className="font-semibold text-brand hover:underline">{started ? "Continue" : "Open"} →</Link>}
                      </li>
                    );
                  })}
                  {exams.length === 0 && <li className="text-muted">No exam for this position. {docsDone ? "Your application is complete." : "Upload your documents above to finish."}</li>}
                </ol>
              </Card>
            );
          })
        )}
      </section>

      {checklist && (
        <Card className={reqOpen ? "border-brand" : ""}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{reqOpen ? "Step 3: Upload your 201 file requirements" : "Step 3: Your 201 file requirements"}</h2>
            {reqOpen ? <Badge tone={checklist.complete ? "success" : "warning"}>{checklist.done} of {checklist.total} required</Badge> : <Badge>Opens after your interview</Badge>}
          </div>
          {reqOpen ? (
            <p className="mt-1 text-sm text-muted">You passed the interview. Please upload these documents so HR can complete your employee file. PDF, PNG or JPEG, up to {config.documentMaxMb} MB each. Large photos are made smaller automatically.</p>
          ) : (
            <p className="mt-1 text-sm text-muted">After your interview, HR opens this step and you can upload the documents below. You can start gathering them now. Your uploads and their status will appear here.</p>
          )}
          <ul className="mt-4 space-y-2">
            {checklist.items.map((i) => <RequirementRow key={i.title} title={i.title} hint={i.hint} required={i.required} fileName={i.doc?.fileName ?? null} version={i.doc?.version ?? null} docId={i.doc?.id ?? null} auto={i.auto} maxMb={config.documentMaxMb} locked={!reqOpen} form={i.form ? { pct: checklist.pds.pct, submitted: checklist.pds.submitted, started: checklist.pds.started } : undefined} />)}
          </ul>
        </Card>
      )}

      {live && withExams.length > 0 && (
        <Card className={scheduled.length ? "border-brand" : ""}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Step 4: Orientation day</h2>
            {scheduled.length === 0 ? <Badge>Not scheduled yet</Badge> : policies.length > 0 && policies.every((x) => x.signed) ? <Badge tone="success">All policies signed</Badge> : <Badge tone="warning">{policies.filter((x) => !x.signed).length} to sign</Badge>}
          </div>
          {scheduled.length === 0 ? (
            <p className="mt-1 text-sm text-muted">Once you are accepted, HR sets your orientation day. On that day you read and sign the company policies, including the privacy policy. We will tell you the date here.</p>
          ) : (
            <>
              <p className="mt-1 text-sm">Your orientation day: <span className="font-semibold">{when.format(scheduled[0])}</span></p>
              <p className="text-sm text-muted">{signingOpen ? "You can read and sign each policy now." : "Signing opens on that day."}</p>
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                {policies.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                    <span className="font-medium">{x.title}</span>
                    {x.signed ? <Badge tone="success">Signed</Badge> : signingOpen ? <Link href={`/apply/policies/${x.id}`} className="font-semibold text-brand hover:underline">Read and sign →</Link> : <Badge>Opens on orientation day</Badge>}
                  </li>
                ))}
                {policies.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">No policy needs a signature right now.</li>}
              </ul>
            </>
          )}
        </Card>
      )}

      {live && (contracts.length > 0 || contractStage) && (
        <Card className={contracts.some((c) => c.status === "ISSUED") ? "border-brand" : ""}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Step 5: Your contract</h2>
            {contracts.length === 0 ? <Badge>Not sent yet</Badge> : contracts.some((c) => c.status === "ISSUED") ? <Badge tone="warning">Waiting for your signature</Badge> : <Badge tone="success">Signed</Badge>}
          </div>
          {contracts.length === 0 && <p className="mt-1 text-sm text-muted">After orientation, HR sends your contract here. You read it and sign it with your signature. Then HR completes your hiring.</p>}
          {contracts.map((c) => (
            <div key={c.id} className="mt-4 space-y-3 rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{c.title}</p>
                <Badge tone={c.status === "SIGNED" ? "success" : "warning"}>{c.status === "SIGNED" ? "Signed" : "Please sign"}</Badge>
              </div>
              <p className="text-sm text-muted">{c.applicant.job.title} · you join as {isEngagement(c.engagement) ? (c.engagement === "EMPLOYEE" ? "an employee" : "a subcontractor") : "a team member"}{c.startDate ? ` · starts ${new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "long" }).format(c.startDate)}` : ""}</p>
              {c.status === "SIGNED" ? (
                <>
                  <p className="text-sm">You signed this contract on <span className="font-semibold">{c.signedAt && when.format(c.signedAt)}</span> as {c.signedName}.</p>
                  <details><summary className="cursor-pointer text-sm font-semibold text-brand">Read the contract</summary><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-4 font-sans text-sm leading-relaxed">{c.body}</pre></details>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted">Read the whole contract, then sign below.</p>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-4 font-sans text-sm leading-relaxed" tabIndex={0} aria-label="Contract text">{c.body}</pre>
                  <SignPolicyForm policyId={c.id} defaultName={me.name} action={signApplicantContract} />
                </>
              )}
            </div>
          ))}
        </Card>
      )}

      <section aria-label="Open positions" className="space-y-3">
        <h2 className="text-lg font-semibold">{open.length === 0 ? "Open positions" : "Other open positions"}</h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted">{jobs.length === 0 ? "No open positions right now." : "You applied for every open position."}</p>
        ) : (
          <ApplyPicker jobs={open.map((j) => ({ id: j.id, title: j.title, description: j.description, descriptionTl: j.descriptionTl, duties: j.duties, dutiesTl: j.dutiesTl, meta: [j.department?.name, `${j.openings} opening${j.openings === 1 ? "" : "s"}`].filter(Boolean).join(" · ") }))} />
        )}
      </section>
    </>
  );
}

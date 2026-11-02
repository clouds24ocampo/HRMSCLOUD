import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getOrgSettings } from "@/lib/settings";
import { dayKey, formatDay } from "@/lib/time";
import { durationMin } from "@/lib/exam-results";
import { KIND_LABEL, passed } from "@/lib/exams";
import { buildChecklist } from "@/lib/requirements";
import { STAGE_LABEL, STAGE_TONE } from "@/lib/stages";
import { Meter } from "@/components/Charts";
import { Badge, Card, PageHeader, ghostClass } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { RecruitmentTabs } from "../../RecruitmentTabs";

const pctOf = (score: number | null, max: number | null) => (max ? Math.round(((score ?? 0) / max) * 100) : 0);

// Everything about one applicant in one place. `id` is any one of their applications; all their other applications are shown too.
export default async function ApplicantProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser("/recruitment");
  const first = await prisma.applicant.findFirst({ where: { id, organizationId: me.organizationId }, select: { id: true, profileId: true } });
  if (!first) notFound();
  const settings = await getOrgSettings(me.organizationId);

  const [apps, profile] = await Promise.all([
    prisma.applicant.findMany({
      where: { organizationId: me.organizationId, ...(first.profileId ? { profileId: first.profileId } : { id: first.id }) },
      orderBy: { createdAt: "asc" },
      include: {
        job: { select: { id: true, title: true } },
        notes: { orderBy: { createdAt: "desc" } },
        attempts: { where: { submittedAt: { not: null } }, orderBy: { submittedAt: "asc" }, include: { exam: { select: { title: true, kind: true, passingPct: true, timeLimitMin: true } } } },
      },
    }),
    first.profileId
      ? prisma.applicantProfile.findUnique({ where: { id: first.profileId }, include: { user: { select: { createdAt: true, active: true } }, documents: { where: { archivedAt: null }, orderBy: { createdAt: "desc" } } } })
      : null,
  ]);
  await audit(me.id, "applicant.profile_viewed", "Applicant", id, undefined, me.organizationId);

  const lead = apps[0];
  const day = (d: Date) => formatDay(dayKey(d, settings.timezone), { month: "short", day: "numeric", year: "numeric" });
  const when = new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, dateStyle: "medium", timeStyle: "short" });
  const employeeId = apps.find((a) => a.employeeId)?.employeeId ?? null;

  // One psychological result per person (copied to each application); every knowledge result.
  const psych = apps.flatMap((a) => a.attempts).find((t) => t.exam.kind === "PSYCHOLOGICAL");
  const traits = Object.entries((psych?.breakdown ?? {}) as Record<string, { score: number; max: number }>).map(([name, v]) => ({ name, pct: v.max ? Math.round((v.score / v.max) * 100) : 0 })).sort((a, b) => b.pct - a.pct);
  const knowledge = apps.flatMap((a) => a.attempts.filter((t) => t.exam.kind === "KNOWLEDGE").map((t) => ({ a, t })));
  const best = apps.map((a) => {
    const k = a.attempts.find((t) => t.exam.kind === "KNOWLEDGE"), p = a.attempts.find((t) => t.exam.kind === "PSYCHOLOGICAL");
    return k && p ? Math.round((pctOf(k.score, k.maxScore) + pctOf(p.score, p.maxScore)) / 2) : null;
  }).reduce<number | null>((m, x) => (x !== null && (m === null || x > m) ? x : m), null);
  const checklist = profile ? buildChecklist(profile.documents, !!profile.resumeKey) : null;
  const showChecklist = !!profile && (profile.documents.length > 0 || apps.some((a) => ["REQUIREMENTS", "OFFER", "HIRED"].includes(a.stage)));
  const notes = apps.flatMap((a) => a.notes.map((n) => ({ ...n, job: a.job.title }))).sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={lead.name}
        subtitle={`${profile ? `Applicant no. ${profile.applicantNo}` : "Added by HR (no applicant account)"} · ${apps.length} ${apps.length === 1 ? "application" : "applications"}`}
        action={<div className="flex flex-wrap gap-2 print:hidden"><Link href="/recruitment/applicants" className={ghostClass}>← All applicants</Link>{employeeId && <Link href={`/employees/${employeeId}`} className={ghostClass}>Employee record</Link>}<PrintButton /></div>}
      />
      <div className="print:hidden"><RecruitmentTabs /></div>

      <Card>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-sm text-muted">Email</p><p className="font-medium [overflow-wrap:anywhere]">{lead.email ?? "–"}</p></div>
          <div><p className="text-sm text-muted">Phone</p><p className="font-medium">{lead.phone ?? "–"}</p></div>
          <div><p className="text-sm text-muted">First applied</p><p className="font-medium">{day(lead.createdAt)}</p></div>
          <div><p className="text-sm text-muted">Source</p><p className="font-medium">{lead.source ?? "Added by HR"}</p></div>
          {profile && <div><p className="text-sm text-muted">Applicant account</p><p className="mt-0.5">{profile.user.active ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Deactivated</Badge>} <span className="text-sm text-muted">since {day(profile.user.createdAt)}</span></p></div>}
          <div><p className="text-sm text-muted">Psychological exam</p><p className="font-medium">{psych ? `${pctOf(psych.score, psych.maxScore)}%` : "Not taken"}</p></div>
          <div><p className="text-sm text-muted">Knowledge exams</p><p className="font-medium">{knowledge.length ? knowledge.map(({ t }) => `${pctOf(t.score, t.maxScore)}%`).join(", ") : "Not taken"}</p></div>
          <div><p className="text-sm text-muted">Best combined score</p><p className="text-xl font-bold">{best === null ? "–" : `${best}%`}</p></div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Positions and stages</h2>
        <ul className="divide-y divide-line">
          {apps.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link href={`/recruitment/${a.job.id}`} className="font-semibold hover:text-brand hover:underline">{a.job.title}</Link>
                <p className="text-sm text-muted">Applied {day(a.createdAt)}{a.interviewAt ? ` · Interview ${when.format(a.interviewAt)}` : ""}</p>
              </div>
              <div className="flex items-center gap-3"><Badge tone={STAGE_TONE[a.stage]}>{STAGE_LABEL[a.stage]}</Badge><Link href={`/recruitment/${a.job.id}`} className="text-sm font-semibold text-brand hover:underline print:hidden">Manage →</Link></div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Exam results</h2>
          {apps.every((a) => a.attempts.length === 0) ? <p className="text-sm text-muted">No exam submitted yet.</p> : (
            <ul className="space-y-3">
              {[...new Map(apps.flatMap((a) => a.attempts).map((t) => [t.examId, t])).values()].map((t) => {
                const pct = pctOf(t.score, t.maxScore);
                const ok = t.exam.passingPct != null ? passed(pct, t.exam.passingPct) : null;
                return (
                  <li key={t.id} className="rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="font-medium">{t.exam.title}</p><p className="text-xs text-muted">{KIND_LABEL[t.exam.kind]} · {durationMin(t.startedAt, t.submittedAt)} of {t.exam.timeLimitMin} min · {t.lang === "tl" ? "Tagalog" : "English"} · {t.submittedAt && day(t.submittedAt)}</p></div>
                      <div className="text-right"><p className="text-2xl font-bold">{pct}%</p>{ok === null ? <Badge>Mindset score</Badge> : ok ? <Badge tone="success">Passed</Badge> : <Badge tone="danger">Below passing</Badge>}</div>
                    </div>
                    <Link href={`/recruitment/results/${t.id}`} className="mt-2 inline-block text-sm font-semibold text-brand hover:underline print:hidden">Review every answer →</Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Mindset by trait</h2>
          {traits.length === 0 ? <p className="text-sm text-muted">Appears after the psychological exam.</p> : (
            <ul className="space-y-3">{traits.map((x) => <li key={x.name}><div className="flex justify-between text-sm"><span>{x.name}</span><span className="font-semibold">{x.pct}%</span></div><div className="mt-1"><Meter value={x.pct} tone={x.pct >= 70 ? "success" : x.pct >= 50 ? "warning" : "danger"} /></div></li>)}</ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Documents</h2>
        {!profile ? <p className="text-sm text-muted">This applicant was added by HR and has no uploaded documents.</p> : (
          <>
            <ul className="divide-y divide-line text-sm">
              <li className="flex items-center justify-between gap-2 py-2"><span className="font-medium">Resume</span>{profile.resumeKey ? <a href={`/recruitment/applicant/${lead.id}/resume`} target="_blank" className="font-semibold text-brand hover:underline">Open</a> : <span className="text-muted">Not uploaded</span>}</li>
              <li className="flex items-center justify-between gap-2 py-2"><span className="font-medium">Valid ID</span>{profile.idKey ? <a href={`/recruitment/applicant/${lead.id}/id`} target="_blank" className="font-semibold text-brand hover:underline">Open</a> : <span className="text-muted">Not uploaded</span>}</li>
            </ul>
            {showChecklist && checklist && (
              <div className="mt-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">201 file requirements</h3><Badge tone={checklist.complete ? "success" : "warning"}>{checklist.done} of {checklist.total} required in</Badge></div>
                <ul className="divide-y divide-line text-sm">
                  {checklist.items.map((i) => (
                    <li key={i.title} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className={i.doc || i.auto ? "" : i.required ? "text-warning" : "text-muted"}>{i.title}{!i.required && <span className="text-xs text-muted"> (if it applies)</span>}{i.doc && <span className="ml-2 text-xs text-muted">{i.doc.fileName}{i.doc.version > 1 ? ` · version ${i.doc.version}` : ""} · {day(i.doc.at)}</span>}</span>
                      {i.doc ? <a href={`/recruitment/applicant/${lead.id}/doc/${i.doc.id}`} target="_blank" className="font-semibold text-brand hover:underline">Open</a> : i.auto ? <a href={`/recruitment/applicant/${lead.id}/resume`} target="_blank" className="font-semibold text-brand hover:underline">Open resume</a> : <span className="text-xs text-muted">{i.required ? "Missing" : "–"}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">History and notes</h2>
        {notes.length === 0 ? <p className="text-sm text-muted">Nothing recorded yet.</p> : (
          <ol className="space-y-2 border-l border-line pl-4 text-sm">
            {notes.map((n) => <li key={n.id}><span>{n.text}</span> <span className="text-muted">· {n.job} · {when.format(n.createdAt)}</span></li>)}
          </ol>
        )}
      </Card>
    </div>
  );
}

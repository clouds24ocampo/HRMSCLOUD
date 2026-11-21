import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getOrgSettings } from "@/lib/settings";
import { dayKey, formatDay } from "@/lib/time";
import { sanitizePds, pdsCompletion } from "@/lib/pds";
import { PdsView } from "@/components/PdsView";
import { PrintButton } from "@/components/PrintButton";
import { Badge, Card, EmptyState, PageHeader, ghostClass } from "@/components/ui";

// An applicant's Personal Data Sheet, for HR and Administrator only. It holds government numbers and other personal information,
// so each time it is opened the audit log records who looked.
export default async function ApplicantPdsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser("/recruitment");
  const a = await prisma.applicant.findFirst({
    where: { id, organizationId: me.organizationId },
    select: { id: true, name: true, profileId: true, profile: { select: { applicantNo: true, pds: { select: { id: true, data: true, completePct: true, submittedAt: true, updatedAt: true } } } } },
  });
  if (!a) notFound();
  const pds = a.profile?.pds ?? null;
  const settings = await getOrgSettings(me.organizationId);
  const day = (d: Date) => formatDay(dayKey(d, settings.timezone), { month: "long", day: "numeric", year: "numeric" });
  if (pds) await audit(me.id, "applicant.pds_viewed", "PersonalDataSheet", pds.id, { applicantId: a.id }, me.organizationId);
  const data = pds ? sanitizePds(pds.data) : null;
  const c = data ? pdsCompletion(data) : null;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={`Personal Data Sheet: ${a.name}`}
        subtitle={`${a.profile ? `Applicant no. ${a.profile.applicantNo}` : "No applicant account"}${pds ? ` · ${pds.submittedAt ? `submitted ${day(pds.submittedAt)}` : `draft, last saved ${day(pds.updatedAt)}`}` : ""}`}
        action={<div className="flex flex-wrap gap-2 print:hidden"><Link href={`/recruitment/applicants/${a.id}`} className={ghostClass}>← Applicant profile</Link>{pds && <PrintButton />}</div>}
      />
      {!pds || !data || !c ? (
        <EmptyState title="Not started" hint={a.profile ? "The applicant has not opened their Personal Data Sheet yet. They fill it out in their portal, under Requirements." : "This applicant has no account, so they cannot fill out the form. Create their account from the applicant card first."} />
      ) : (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <p className="text-sm text-muted">Confidential. Contains government numbers and personal information. Opening this page is recorded in the audit log.</p>
            <div className="flex items-center gap-2">{pds.submittedAt ? <Badge tone="success">Submitted</Badge> : <Badge tone="warning">Draft: {c.pct}% complete</Badge>}</div>
          </Card>
          {!pds.submittedAt && c.missing.length > 0 && (
            <Card className="print:hidden"><p className="text-sm font-semibold">Still missing ({c.missing.length})</p><ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{c.missing.slice(0, 40).map((m) => <li key={`${m.section}${m.label}`}><span className="text-muted">{m.section}:</span> {m.label}</li>)}</ul></Card>
          )}
          <PdsView data={data} />
        </>
      )}
    </div>
  );
}

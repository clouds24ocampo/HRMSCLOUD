/* eslint-disable @next/next/no-img-element -- signature images behind a signed-in route */
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { POLICY_KIND_LABEL } from "@/lib/policies";
import { isHr } from "@/lib/scope";
import { formatDay, formatTime, dayKey } from "@/lib/time";
import { getOrgSettings } from "@/lib/settings";
import { Badge, Card, PageHeader } from "@/components/ui";
import { SignPolicyForm } from "../PolicyForms";

export default async function PolicyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ employee?: string }> }) {
  const me = await requireUser("/policies");
  const { id } = await params;
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const mine = await getMyEmployee(me, tz);
  const hr = isHr(me.role.key);
  const employeeId = hr && sp.employee ? sp.employee : mine.id;
  const p = await prisma.policyDocument.findFirst({ where: { id, organizationId: me.organizationId } });
  if (!p) notFound();
  const [mySig, all, unsigned] = await Promise.all([
    prisma.policySignature.findUnique({ where: { policyId_employeeId: { policyId: p.id, employeeId } } }),
    hr ? prisma.policySignature.findMany({ where: { policyId: p.id, organizationId: me.organizationId }, include: { employee: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } }) : [],
    hr ? prisma.employee.findMany({ where: { organizationId: me.organizationId, status: { in: ["ACTIVE", "ON_LEAVE"] }, signatures: { none: { policyId: p.id } } }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }) : [],
  ]);
  const when = (d: Date) => `${formatDay(dayKey(d, tz), { month: "short", day: "numeric", year: "numeric" })} ${formatTime(d, tz)}`;
  const own = employeeId === mine.id;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/policies" className="text-sm font-medium text-muted hover:text-ink print:hidden">← Policies</Link>
      <PageHeader
        title={p.title}
        subtitle={`${POLICY_KIND_LABEL[p.kind]} · version ${p.version}${p.archivedAt ? " · replaced by a newer version" : ""}`}
        action={p.requiresSignature ? mySig ? <Badge tone="success">Signed</Badge> : <Badge tone="danger">Not signed</Badge> : <Badge>For reading</Badge>}
      />
      <Card>
        {p.storageKey ? (
          <div className="space-y-2">
            <iframe src={`/policies/${p.id}/file`} title={p.title} className="h-[70vh] w-full rounded-xl border border-line bg-white" />
            <a href={`/policies/${p.id}/file`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand hover:underline print:hidden">Open the PDF in a new tab</a>
          </div>
        ) : (
          <div className="whitespace-pre-line text-sm leading-relaxed">{p.body}</div>
        )}
        <p className="mt-4 break-all text-xs text-muted">Document fingerprint (SHA-256): {p.contentHash}</p>
      </Card>

      {mySig ? (
        <Card className="space-y-2">
          <h2 className="font-semibold">{own ? "Your signature" : "Signature"}</h2>
          <img src={`/policies/signature/${mySig.id}`} alt={`Signature of ${mySig.signedName}`} className="h-20 max-w-xs rounded-lg border border-line bg-white object-contain p-1" />
          <p className="text-sm">{mySig.signedName} · {when(mySig.createdAt)}</p>
          <p className="text-xs text-muted">Recorded from {mySig.ipAddress ?? "unknown address"}. Covers exactly the document with the fingerprint above{mySig.contentHash === p.contentHash ? "" : " (fingerprint differs: check the version)"}.</p>
        </Card>
      ) : own && p.requiresSignature && !p.archivedAt ? (
        <Card>
          <h2 className="mb-3 font-semibold">Sign this document</h2>
          <SignPolicyForm policyId={p.id} defaultName={me.name} />
        </Card>
      ) : null}

      {hr && (
        <Card className="space-y-3">
          <h2 className="font-semibold">Signatures <Badge tone="success">{all.length} signed</Badge> {unsigned.length > 0 && <Badge tone="danger">{unsigned.length} not yet</Badge>}</h2>
          {all.length > 0 && (
            <ul className="divide-y divide-line rounded-xl border border-line text-sm">
              {all.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span><span className="font-medium">{s.employee.firstName} {s.employee.lastName}</span> · signed as “{s.signedName}”</span>
                  <span className="flex items-center gap-2 text-muted">{when(s.createdAt)} <img src={`/policies/signature/${s.id}`} alt="" className="h-8 w-24 rounded border border-line bg-white object-contain" /></span>
                </li>
              ))}
            </ul>
          )}
          {unsigned.length > 0 && <p className="text-sm text-muted">Not signed yet: {unsigned.map((u) => `${u.firstName} ${u.lastName}`).join(", ")}</p>}
        </Card>
      )}
    </div>
  );
}

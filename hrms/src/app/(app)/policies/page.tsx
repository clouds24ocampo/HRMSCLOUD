import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { ensurePolicies, POLICY_KIND_LABEL } from "@/lib/policies";
import { isHr } from "@/lib/scope";
import { Badge, Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { ArchivePolicyButton, PublishPolicyForm } from "./PolicyForms";

export default async function PoliciesPage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  const me = await requireUser("/policies");
  const sp = await searchParams;
  await ensurePolicies(me.organizationId, me.organization.name);
  const mine = await getMyEmployee(me);
  const hr = isHr(me.role.key);
  // HR can look at anyone's signatures; everyone else sees their own.
  const employeeId = hr && sp.employee ? sp.employee : mine.id;
  const [policies, person, headcount, people] = await Promise.all([
    prisma.policyDocument.findMany({
      where: { organizationId: me.organizationId, archivedAt: null },
      include: { signatures: { where: { employeeId }, select: { id: true, createdAt: true } }, _count: { select: { signatures: true } } },
      orderBy: [{ kind: "asc" }, { title: "asc" }],
    }),
    prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId }, select: { firstName: true, lastName: true } }),
    hr ? prisma.employee.count({ where: { organizationId: me.organizationId, status: { in: ["ACTIVE", "ON_LEAVE"] } } }) : 0,
    hr ? prisma.employee.findMany({ where: { organizationId: me.organizationId, status: { not: "SEPARATED" } }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" }, take: 500 }) : [],
  ]);
  const own = employeeId === mine.id;
  const toSign = policies.filter((p) => p.requiresSignature && p.signatures.length === 0).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Policies"
        subtitle={own ? "User agreement, terms and conditions, privacy policies and company policies. Read each one and sign it." : `Signatures of ${person?.firstName} ${person?.lastName}.`}
        action={toSign > 0 ? <Badge tone="danger">{toSign} to sign</Badge> : <Badge tone="success">All signed</Badge>}
      />

      {hr && (
        <form className="flex flex-wrap items-end gap-2" role="search">
          <label className="block min-w-0 flex-1 basis-56 text-sm font-medium">
            Whose signatures
            <select name="employee" defaultValue={employeeId} className={inputClass}>
              {people.map((p) => <option key={p.id} value={p.id}>{p.lastName}, {p.firstName}{p.id === mine.id ? " (me)" : ""}</option>)}
            </select>
          </label>
          <button className={buttonClass}>Show</button>
        </form>
      )}

      <Card className="p-0">
        {policies.length === 0 ? <div className="p-5"><EmptyState title="No policies yet" /></div> : (
          <ul className="divide-y divide-line">
            {policies.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <Link href={`/policies/${p.id}${own ? "" : `?employee=${employeeId}`}`} className="font-semibold hover:underline">{p.title}</Link>
                  <p className="text-sm text-muted">{POLICY_KIND_LABEL[p.kind]} · version {p.version}{p.fileName ? " · PDF" : ""}{hr ? ` · signed by ${p._count.signatures} of ${headcount}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!p.requiresSignature ? <Badge>For reading</Badge> : p.signatures.length ? <Badge tone="success">Signed {p.signatures[0].createdAt.toISOString().slice(0, 10)}</Badge> : <Badge tone="danger">Not signed</Badge>}
                  {hr && <ArchivePolicyButton id={p.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {hr && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Publish a policy</h2>
          <PublishPolicyForm kinds={Object.entries(POLICY_KIND_LABEL).map(([value, label]) => ({ value, label }))} />
        </Card>
      )}
      <p className="text-xs text-muted">The starting texts are plain-language templates. Review them with your legal adviser and publish your own versions.</p>
    </div>
  );
}

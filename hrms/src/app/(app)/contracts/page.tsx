import { Icon, ICON_INLINE } from "@/components/Icon";
import Link from "next/link";
import type { ContractStatus } from "@/generated/prisma/client";
import { CONTRACT_STATUS_BADGE as STATUS_BADGE } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { isHr } from "@/lib/scope";
import { formatDay, keyOfDbDate } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { GenerateContractForm, type EmployeeOption } from "./ContractForms";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string; status?: string }>;
}) {
  const me = await requireUser("/contracts");
  const settings = await getOrgSettings(me.organizationId);
  const mine = await getMyEmployee(me, settings.timezone);
  const hr = isHr(me.role.key);
  const sp = await searchParams;

  const employeeFilter = hr && sp.employee ? sp.employee : undefined;
  const statusFilter = sp.status ? (sp.status.toUpperCase() as ContractStatus) : undefined;

  // Contracts query
  const contracts = await prisma.contract.findMany({
    where: {
      organizationId: me.organizationId,
      ...(hr ? (employeeFilter ? { employeeId: employeeFilter } : {}) : { employeeId: mine.id }),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNo: true,
          address: true,
          position: { select: { title: true } },
          department: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Eligible employees for HR contract creation
  const allEmployees = hr
    ? await prisma.employee.findMany({
        where: { organizationId: me.organizationId, status: { not: "SEPARATED" } },
        include: {
          position: { select: { title: true } },
          department: { select: { name: true } },
          compensations: {
            where: { effectiveFrom: { lte: new Date() } },
            orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
            take: 1,
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      })
    : [];

  const employeeOptions: EmployeeOption[] = allEmployees.map((e) => {
    const comp = e.compensations[0];
    return {
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      employeeNo: e.employeeNo,
      position: e.position?.title ?? "Staff",
      department: e.department?.name ?? "General",
      address: e.address ?? "",
      salary: comp ? `${formatMoney(comp.rateCents)} (${comp.payType.toLowerCase()})` : "",
      startDate: formatDay(keyOfDbDate(e.hireDate), { month: "long", day: "numeric", year: "numeric" }),
    };
  });

  const pendingSigning = contracts.filter((c) => c.status === "ISSUED" && (!hr || c.employeeId === mine.id));
  const signedCount = contracts.filter((c) => c.status === "SIGNED").length;
  const issuedCount = contracts.filter((c) => c.status === "ISSUED").length;
  const draftCount = contracts.filter((c) => c.status === "DRAFT").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Employment Contracts"
        subtitle={
          hr
            ? "Generate, import, issue, and manage employee employment contracts with exact names, addresses, and positions."
            : "Review and electronically sign your employment agreements."
        }
        action={
          <div className="flex gap-2">
            <Link
              href="/handbook"
              className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold shadow-sm hover:border-brand hover:text-brand transition"
            >
              <Icon name="handbook" className={ICON_INLINE} /> Company Handbook
            </Link>
          </div>
        }
      />

      {/* Action banner for employee if contract requires signature */}
      {pendingSigning.length > 0 && (
        <section aria-label="Contracts needing your signature" className="rounded-2xl border-2 border-brand/40 bg-linear-to-r from-brand/10 to-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Icon name="sign" className="h-6 w-6 text-brand" />
            <h2 className="text-lg font-bold text-ink">
              You have {pendingSigning.length} contract agreement{pendingSigning.length > 1 ? "s" : ""} waiting for your signature
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {pendingSigning.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 shadow-sm">
                <div>
                  <h3 className="font-bold text-ink">{c.title}</h3>
                  <p className="text-xs text-muted">
                    Issued {c.issuedAt ? formatDay(keyOfDbDate(c.issuedAt)) : "recently"} · Ready for e-signature
                  </p>
                </div>
                <Link
                  href={`/contracts/${c.id}`}
                  className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-brand-ink shadow-sm transition hover:bg-brand/90"
                >
                  Review & Sign →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Summary Stats */}
      <section aria-label="Contract statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total Contracts" value={contracts.length} tone="brand" />
        <Stat label="Signed & Active" value={signedCount} tone="success" />
        <Stat label="Awaiting Signature" value={issuedCount} tone={issuedCount > 0 ? "warning" : "neutral"} />
        <Stat label="Drafts" value={draftCount} tone="neutral" />
      </section>

      {/* HR: Generator / Importer Section */}
      {hr && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Generate & Issue Employment Contract</h2>
              <p className="text-xs text-muted">
                Pulls employee name, residential address, position, department, and salary automatically into Philippine-compliant contracts.
              </p>
            </div>
            <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
              Enterprise Generator
            </span>
          </div>

          <GenerateContractForm
            employees={employeeOptions}
            prefilledEmployeeId={sp.employee}
            companyName={me.organization.name}
          />
        </Card>
      )}

      {/* Contract Listing Table */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <h2 className="text-lg font-bold text-ink">
            {hr ? "Contract Records" : "My Employment Contracts"}
          </h2>
          {hr && (
            <div className="flex items-center gap-2 text-xs">
              <Link
                href="/contracts"
                className={`rounded-lg px-2.5 py-1 ${!statusFilter ? "bg-brand text-brand-ink font-bold" : "text-muted hover:bg-bg"}`}
              >
                All
              </Link>
              <Link
                href="/contracts?status=issued"
                className={`rounded-lg px-2.5 py-1 ${statusFilter === "ISSUED" ? "bg-brand text-brand-ink font-bold" : "text-muted hover:bg-bg"}`}
              >
                Issued
              </Link>
              <Link
                href="/contracts?status=signed"
                className={`rounded-lg px-2.5 py-1 ${statusFilter === "SIGNED" ? "bg-brand text-brand-ink font-bold" : "text-muted hover:bg-bg"}`}
              >
                Signed
              </Link>
              <Link
                href="/contracts?status=draft"
                className={`rounded-lg px-2.5 py-1 ${statusFilter === "DRAFT" ? "bg-brand text-brand-ink font-bold" : "text-muted hover:bg-bg"}`}
              >
                Drafts
              </Link>
            </div>
          )}
        </div>

        {contracts.length === 0 ? (
          <EmptyState
            title="No contracts found"
            hint={hr ? "Use the form above to generate your first contract." : "No contract records have been issued to your account yet."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-bg/50 text-xs font-semibold uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Contract Title</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="w-px whitespace-nowrap px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {contracts.map((c) => {
                  const b = STATUS_BADGE[c.status] ?? STATUS_BADGE.DRAFT;
                  return (
                    <tr key={c.id} className="hover:bg-bg/40 transition">
                      <td className="px-4 py-3 font-semibold text-ink">
                        <Link href={`/contracts/${c.id}`} className="hover:text-brand hover:underline">
                          {c.title}
                        </Link>
                        <p className="text-[11px] font-normal text-muted">
                          Created {formatDay(keyOfDbDate(c.createdAt))}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">
                          {c.employee.firstName} {c.employee.lastName}
                        </div>
                        <div className="text-xs text-muted">{c.employee.employeeNo}</div>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {c.employee.position?.title ?? "Staff"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted max-w-50 truncate" title={c.employee.address || "None on file"}>
                        {c.employee.address || <span className="italic text-warning">None set</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={b.tone}>{b.label}</Badge>
                      </td>
                      <td className="w-px whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={`/contracts/${c.id}`}
                          className="inline-block whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand hover:text-brand transition shadow-sm"
                        >
                          View Document →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

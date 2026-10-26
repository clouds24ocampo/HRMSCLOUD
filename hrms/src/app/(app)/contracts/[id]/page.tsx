import { DEFAULT_TIMEZONE } from "@/lib/locale";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CONTRACT_STATUS_BADGE as STATUS_BADGE } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { isHr } from "@/lib/scope";
import { formatDay, formatTime, keyOfDbDate } from "@/lib/time";
import { Badge, Card } from "@/components/ui";
import { IssueContractButton, PrintButton, RestoreContractButton, SignContractForm, VoidContractButton } from "../ContractForms";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser("/contracts");
  const { id } = await params;
  const mine = await getMyEmployee(me);
  const hr = isHr(me.role.key);

  const contract = await prisma.contract.findFirst({
    where: {
      id,
      organizationId: me.organizationId,
      ...(hr ? {} : { employeeId: mine.id }),
    },
    include: {
      employee: {
        include: {
          position: true,
          department: true,
          user: true,
        },
      },
      organization: true,
    },
  });

  if (!contract) return notFound();

  const isSigner = contract.employee.userId === me.id;
  const canSign = isSigner && contract.status === "ISSUED";
  const badge = STATUS_BADGE[contract.status] ?? STATUS_BADGE.DRAFT;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Navigation & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/contracts"
          className="text-sm font-semibold text-muted hover:text-brand transition flex items-center gap-1"
        >
          ← Back to Contracts
        </Link>
        <div className="flex items-center gap-2">
          <PrintButton />
          {hr && contract.status === "DRAFT" && (
            <IssueContractButton contractId={contract.id} />
          )}
          {hr && contract.status !== "VOID" && (
            <VoidContractButton contractId={contract.id} />
          )}
          {hr && contract.status === "VOID" && (
            <RestoreContractButton contractId={contract.id} />
          )}
        </div>
      </div>

      {/* Contract Metadata Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-ink">{contract.title}</h1>
          <p className="text-xs text-muted mt-1">
            Created {formatDay(keyOfDbDate(contract.createdAt))} · Employee: {contract.employee.firstName} {contract.employee.lastName} ({contract.employee.employeeNo})
          </p>
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>

      {/* Document View: Formatted for Reading & Printing */}
      <Card className="p-8 sm:p-12 bg-white text-gray-900 border shadow-md print:shadow-none print:border-none print:p-0">
        {/* Company Header */}
        <header className="border-b-2 border-gray-900 pb-4 mb-6 text-center">
          <h2 className="text-xl font-black uppercase tracking-wider text-gray-900">
            {contract.organization.name}
          </h2>
          <p className="text-xs text-gray-600 mt-1">
            Human Resources & People Operations · Republic of the Philippines
          </p>
        </header>

        {/* Contract Text Body */}
        <div className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-gray-900 space-y-4">
          {contract.body}
        </div>

        {/* Formal Signature Certificate Box */}
        <div className="mt-12 pt-8 border-t-2 border-gray-900 grid grid-cols-2 gap-8 text-xs font-sans">
          <div>
            <p className="font-bold uppercase text-gray-700">Company Authorized Officer:</p>
            <div className="mt-8 border-t border-gray-400 pt-1">
              <p className="font-bold text-gray-900">{contract.organization.name}</p>
              <p className="text-gray-500">Human Resources Department</p>
            </div>
          </div>

          <div>
            <p className="font-bold uppercase text-gray-700">Employee Signature:</p>
            <div className="mt-8 border-t border-gray-400 pt-1">
              <p className="font-bold text-gray-900">
                {contract.employee.firstName} {contract.employee.lastName}
              </p>
              <p className="text-gray-600">{contract.employee.position?.title ?? "Employee"}</p>
              <p className="text-[11px] text-gray-500">Address: {contract.employee.address || "On File"}</p>
              {contract.status === "SIGNED" && contract.signedAt && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                  <span>✓ Digitally signed on</span> {formatDay(keyOfDbDate(contract.signedAt))} at {formatTime(contract.signedAt, DEFAULT_TIMEZONE)}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Signature Action Box for Employee */}
      {canSign && (
        <div className="print:hidden">
          <SignContractForm contractId={contract.id} title={contract.title} />
        </div>
      )}
    </div>
  );
}

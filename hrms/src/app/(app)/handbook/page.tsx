import { Icon, ICON_INLINE } from "@/components/Icon";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { isHr } from "@/lib/scope";
import { ensureHandbook } from "@/lib/handbook";
import { formatDay, keyOfDbDate } from "@/lib/time";
import { Badge, Card, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { AcknowledgeHandbookForm, AddHandbookSectionForm } from "./HandbookForms";

export default async function HandbookPage() {
  const me = await requireUser("/handbook");
  const settings = await getOrgSettings(me.organizationId);
  const mine = await getMyEmployee(me, settings.timezone);
  const hr = isHr(me.role.key);

  // Automatically seed standard handbook chapters if not yet created
  await ensureHandbook(me.organizationId, me.organization.name);

  // Fetch sections and acknowledgment status
  const [sections, myAck, allAcks, totalEmployees] = await Promise.all([
    prisma.handbookSection.findMany({
      where: { organizationId: me.organizationId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.handbookAcknowledgment.findUnique({
      where: { employeeId_version: { employeeId: mine.id, version: 1 } },
    }),
    hr
      ? prisma.handbookAcknowledgment.findMany({
          where: { organizationId: me.organizationId, version: 1 },
          include: { employee: { select: { firstName: true, lastName: true, employeeNo: true } } },
          orderBy: { signedAt: "desc" },
        })
      : [],
    hr
      ? prisma.employee.count({
          where: { organizationId: me.organizationId, status: { in: ["ACTIVE", "ON_LEAVE"] } },
        })
      : 0,
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <PageHeader
          title="Company Employee Handbook"
          subtitle="Official policies, working hours, attendance standards, progressive discipline, leaves, and employee code of conduct."
          action={
            myAck ? (
              <Badge tone="success">
                <Icon name="ok" className={ICON_INLINE} /> Acknowledged on {formatDay(keyOfDbDate(myAck.signedAt))}
              </Badge>
            ) : (
              <Badge tone="warning">Acknowledgment Pending</Badge>
            )
          }
        />
        <div className="flex items-center gap-2">
          <Link
            href="/contracts"
            className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold shadow-sm hover:border-brand hover:text-brand transition"
          >
            <Icon name="contract" className={ICON_INLINE} /> Employment Contracts
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* HR Oversight: Acknowledgment Tracking */}
      {hr && (
        <Card className="print:hidden bg-linear-to-r from-brand/5 to-surface space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <div>
              <h2 className="font-bold text-ink">Employee Acknowledgment Tracking</h2>
              <p className="text-xs text-muted">
                {allAcks.length} of {totalEmployees} active personnel have officially acknowledged the handbook
              </p>
            </div>
            <div className="text-right font-black text-lg text-brand">
              {totalEmployees > 0 ? `${Math.round((allAcks.length / totalEmployees) * 100)}%` : "100%"}
            </div>
          </div>
          {allAcks.length > 0 && (
            <div className="max-h-36 overflow-y-auto divide-y divide-line text-xs">
              {allAcks.map((a) => (
                <div key={a.id} className="py-1.5 flex items-center justify-between text-muted">
                  <span className="font-medium text-ink">
                    {a.employee.firstName} {a.employee.lastName} ({a.employee.employeeNo})
                  </span>
                  <span>Acknowledged {formatDay(keyOfDbDate(a.signedAt))}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Table of Contents Header */}
      <Card className="print:hidden">
        <h2 className="font-bold text-sm text-ink mb-2"><Icon name="list" className={ICON_INLINE} /> Table of Contents</h2>
        <ul className="grid gap-2 sm:grid-cols-2 text-xs">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.slug}`}
                className="font-medium text-brand hover:underline flex items-center gap-1.5"
              >
                <span>•</span>
                <span>{s.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </Card>

      {/* Handbook Content Document */}
      <div className="space-y-6">
        {sections.map((s) => (
          <div key={s.id} id={s.slug} className="scroll-mt-6">
            <Card className="p-6 sm:p-8 bg-surface border shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h2 className="text-xl font-bold tracking-tight text-ink">{s.title}</h2>
                <span className="text-[11px] font-semibold text-muted uppercase">
                  Section {s.sortOrder}
                </span>
              </div>

              <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink/90 space-y-3">
                {s.content}
              </div>
            </Card>
          </div>
        ))}
      </div>

      {/* HR Add Chapter */}
      {hr && (
        <div className="print:hidden">
          <AddHandbookSectionForm />
        </div>
      )}

      {/* Acknowledgment Card for Employee */}
      {!myAck && (
        <div className="print:hidden">
          <AcknowledgeHandbookForm />
        </div>
      )}
    </div>
  );
}

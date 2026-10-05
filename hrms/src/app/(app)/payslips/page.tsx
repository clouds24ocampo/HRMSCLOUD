import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { formatMoney } from "@/lib/money";
import { formatDay, keyOfDbDate } from "@/lib/time";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export default async function MyPayslipsPage() {
  const me = await requireUser("/payslips");
  const emp = await getMyEmployee(me);
  // Only finalized payslips: nothing is shown while payroll is still being checked.
  const slips = await prisma.payslip.findMany({
    where: { employeeId: emp.id, organizationId: me.organizationId, period: { status: "FINALIZED" } },
    include: { period: { select: { name: true, startDate: true, endDate: true, payDate: true } } },
    orderBy: { period: { payDate: "desc" } },
    take: 36,
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="My payslips" subtitle="Released after payroll is approved and locked." />
      {slips.length === 0 ? (
        <EmptyState title="No payslips yet" hint="Your payslip appears here when payroll for a period is finalized." />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {slips.map((s) => (
              <li key={s.id}>
                <Link href={`/payslips/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 transition hover:bg-bg">
                  <div>
                    <p className="font-medium">{s.period.name}</p>
                    <p className="text-sm text-muted">Paid {formatDay(keyOfDbDate(s.period.payDate), { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                  <p className="text-lg font-bold tabular-nums">{formatMoney(s.netCents)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

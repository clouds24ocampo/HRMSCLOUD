import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { idCardFor } from "@/lib/id-card";
import { canViewEmployee, isHr } from "@/lib/scope";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { PrintButton } from "@/app/(app)/payslips/[id]/PrintButton";
import { IdCard } from "./IdCard";
import { IdDetailsForm, PhotoForm } from "./IdForms";
import { dayKey, keyOfDbDate } from "@/lib/time";

export default async function DigitalIdPage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  const me = await requireUser("/id");
  const sp = await searchParams;
  const mine = await getMyEmployee(me);
  const employeeId = sp.employee ?? mine.id;
  if (!(await canViewEmployee(me, mine.id, employeeId))) notFound();
  const hr = isHr(me.role.key);
  const own = employeeId === mine.id;
  // Government numbers are sensitive: in full only for the owner and HR; supervisors who open the card see them hidden.
  const card = await idCardFor(me.organizationId, employeeId, { revealNumbers: own || hr });
  if (!card) notFound();
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId }, select: { photoKey: true, sssNo: true, philhealthNo: true, tinNo: true, pagibigNo: true, idIssuedOn: true } });
  const hasPhoto = !!emp?.photoKey;
  const validYears = (await prisma.idCardSettings.findUnique({ where: { organizationId: me.organizationId }, select: { validYears: true } }))?.validYears ?? 2;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={own ? "My digital ID" : `Digital ID of ${card.name}`}
        subtitle="Front and back. Show it on your phone or print it. Scanning the QR code on the back opens the profile for HR and supervisors."
        action={<div className="flex flex-wrap gap-2 print:hidden"><PrintButton />{hr && <Link href="/id/design" className={buttonClass}>Edit ID design</Link>}</div>}
      />
      <IdCard d={card} />
      {(own || hr) && (
        <div className="grid gap-6 md:grid-cols-2 print:hidden">
          <Card className="h-fit space-y-3">
            <h2 className="font-semibold">{hasPhoto ? "Change picture" : "Add your picture"}</h2>
            {!hasPhoto && <p className="text-sm text-warning">This ID has no picture yet.</p>}
            <PhotoForm employeeId={employeeId} />
          </Card>
          {hr && emp && (
            <Card className="h-fit space-y-3">
              <h2 className="font-semibold">Government numbers and issue date</h2>
              <IdDetailsForm employeeId={employeeId} validYears={validYears} v={{ sss: emp.sssNo ?? "", philhealth: emp.philhealthNo ?? "", tin: emp.tinNo ?? "", pagibig: emp.pagibigNo ?? "", idIssuedOn: emp.idIssuedOn ? keyOfDbDate(emp.idIssuedOn) : dayKey(new Date(), "Asia/Manila") }} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

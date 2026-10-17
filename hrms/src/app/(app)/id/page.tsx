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
import { PhotoForm } from "./IdForms";

export default async function DigitalIdPage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  const me = await requireUser("/id");
  const sp = await searchParams;
  const mine = await getMyEmployee(me);
  const employeeId = sp.employee ?? mine.id;
  if (!(await canViewEmployee(me, mine.id, employeeId))) notFound();
  const card = await idCardFor(me.organizationId, employeeId);
  if (!card) notFound();
  const hr = isHr(me.role.key);
  const own = employeeId === mine.id;
  const hasPhoto = !!(await prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId }, select: { photoKey: true } }))?.photoKey;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={own ? "My digital ID" : `Digital ID of ${card.name}`}
        subtitle="Show it on your phone or print it. Scanning the QR code opens the profile for HR and supervisors."
        action={<div className="flex flex-wrap gap-2 print:hidden"><PrintButton />{hr && <Link href="/id/design" className={buttonClass}>Edit ID design</Link>}</div>}
      />
      <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
        <IdCard d={card} />
        {(own || hr) && (
          <Card className="h-fit space-y-3 print:hidden">
            <h2 className="font-semibold">{hasPhoto ? "Change picture" : "Add your picture"}</h2>
            {!hasPhoto && <p className="text-sm text-warning">Your ID has no picture yet.</p>}
            <PhotoForm employeeId={employeeId} />
          </Card>
        )}
      </div>
    </div>
  );
}

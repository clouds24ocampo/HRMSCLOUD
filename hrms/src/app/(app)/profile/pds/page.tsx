import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { sanitizePds } from "@/lib/pds";
import { PdsView } from "@/components/PdsView";
import { PrintButton } from "@/components/PrintButton";
import { EmptyState, PageHeader, ghostClass } from "@/components/ui";

// The signed-in person's own Personal Data Sheet (the one they filled out when they applied). Read only.
export default async function MyPdsPage() {
  const me = await requireUser("/profile");
  const settings = await getOrgSettings(me.organizationId);
  const mine = await getMyEmployee(me, settings.timezone);
  const pds = await prisma.personalDataSheet.findFirst({ where: { employeeId: mine.id, organizationId: me.organizationId }, select: { data: true } });
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="My personal data sheet"
        subtitle="The personal information you gave when you applied. To correct something, ask HR."
        action={<div className="flex flex-wrap gap-2 print:hidden"><Link href="/profile" className={ghostClass}>← My profile</Link>{pds && <PrintButton />}</div>}
      />
      {pds ? <PdsView data={sanitizePds(pds.data)} /> : <EmptyState title="No personal data sheet on file" hint="You were not hired through the applicant portal, or HR keeps it on paper. Ask HR if you need it added." />}
    </div>
  );
}

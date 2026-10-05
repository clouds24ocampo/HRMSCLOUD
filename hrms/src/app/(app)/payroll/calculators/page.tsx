import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { Calculators } from "./Calculators";

export default async function CalculatorsPage() {
  await requireUser("/payroll");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/payroll/setup" className="text-sm font-medium text-muted hover:text-ink">← Pay setup</Link>
      <PageHeader title="Benefit estimates" subtitle="Plan advances and employer differentials. These are estimates: SSS, GSIS and the other agencies decide the actual benefit." />
      <Calculators />
    </div>
  );
}

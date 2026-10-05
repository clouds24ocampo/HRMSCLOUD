import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { HOLIDAY_LABEL } from "@/lib/labels";
import { getOrgSettings } from "@/lib/settings";
import { dayKey, formatDay, keyOfDbDate, dbDate } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader, ghostClass } from "@/components/ui";
import { AddHolidayForm, RemoveHolidayButton, StandardHolidaysForm } from "./HolidayForms";

const TONE = { REGULAR: "danger", SPECIAL_NON_WORKING: "warning", SPECIAL_WORKING: "neutral" } as const;

export default async function HolidaysPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const me = await requireUser("/payroll");
  const settings = await getOrgSettings(me.organizationId);
  const thisYear = Number(dayKey(new Date(), settings.timezone).slice(0, 4));
  const sp = await searchParams;
  const year = /^\d{4}$/.test(sp.year ?? "") ? Number(sp.year) : thisYear;
  const holidays = await prisma.holiday.findMany({ where: { organizationId: me.organizationId, date: { gte: dbDate(`${year}-01-01`), lte: dbDate(`${year}-12-31`) } }, orderBy: { date: "asc" } });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/payroll/setup" className="text-sm font-medium text-muted hover:text-ink">← Pay setup</Link>
      <PageHeader title="Holiday calendar" subtitle="Payroll pays holiday premiums from these dates. A day with no entry is an ordinary day." />
      <div role="note" className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
        The button adds the holidays fixed by law and Holy Week. The government also proclaims holidays each year (Eid&apos;l Fitr, Eid&apos;l Adha, extra special days, moved dates). Add those yourself from the proclamation, and check this list against it before running payroll.
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Year">
        {[year - 1, year, year + 1].map((y) => <Link key={y} href={`/payroll/holidays?year=${y}`} className={ghostClass} aria-current={y === year ? "page" : undefined}>{y}</Link>)}
      </div>
      {holidays.length === 0 ? (
        <EmptyState title={`No holidays for ${year}`} hint="Add the ones fixed by law, then the ones proclaimed this year." />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {holidays.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div>
                  <p className="font-medium">{h.name}</p>
                  <p className="text-sm text-muted">{formatDay(keyOfDbDate(h.date), { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={TONE[h.type]}>{HOLIDAY_LABEL[h.type]}</Badge>
                  <RemoveHolidayButton id={h.id} label={h.name} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Card><h2 className="mb-3 text-lg font-semibold">Fixed by law</h2><StandardHolidaysForm year={year} /></Card>
        <Card><h2 className="mb-3 text-lg font-semibold">Add one</h2><AddHolidayForm /></Card>
      </div>
    </div>
  );
}

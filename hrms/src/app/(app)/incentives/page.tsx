import { DEFAULT_LOCALE } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { employeeScope, isHr } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { formatDay, formatTime, keyOfDbDate } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { AcceptIncentiveForm, AwardIncentiveForm, DeclineIncentiveForm } from "./IncentiveForms";

const STATUS_BADGE: Record<string, { label: string; tone: "warning" | "success" | "neutral" | "danger" }> = {
  PENDING: { label: "Awaiting Acceptance", tone: "warning" },
  ACCEPTED: { label: "Accepted (Ready for Payroll)", tone: "success" },
  PAID: { label: "Paid in Payroll", tone: "neutral" },
  DECLINED: { label: "Declined", tone: "danger" },
};

export default async function IncentivesPage() {
  const me = await requireUser("/incentives");
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const mine = await getMyEmployee(me, tz);
  const lead = isHr(me.role.key) || me.role.key === ROLES.MANAGER;

  // Load employee's own incentives
  const myIncentives = await prisma.incentive.findMany({
    where: { employeeId: mine.id, organizationId: me.organizationId },
    orderBy: { createdAt: "desc" },
  });

  const myPending = myIncentives.filter((i) => i.status === "PENDING");
  const myCompleted = myIncentives.filter((i) => i.status !== "PENDING");

  // Load all org incentives for HR/Managers
  const allIncentives = lead
    ? await prisma.incentive.findMany({
        where: { organizationId: me.organizationId },
        include: {
          employee: { select: { firstName: true, lastName: true, employeeNo: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const eligibleEmployees = lead
    ? await prisma.employee.findMany({
        where: { ...(await employeeScope(me, mine.id)), status: "ACTIVE" },
        select: { id: true, firstName: true, lastName: true, employeeNo: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      })
    : [];

  const userIds = [
    ...new Set([
      ...myIncentives.map((i) => i.awardedById),
      ...allIncentives.map((i) => i.awardedById),
    ]),
  ];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const who = new Map(users.map((u) => [u.id, u.name]));

  const formatPhp = (cents: number) =>
    `₱${(cents / 100).toLocaleString(DEFAULT_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalAwardedCents = allIncentives.reduce((sum, i) => sum + i.amountCents, 0);
  const pendingCount = allIncentives.filter((i) => i.status === "PENDING").length;
  const acceptedCount = allIncentives.filter((i) => i.status === "ACCEPTED").length;
  const paidCount = allIncentives.filter((i) => i.status === "PAID").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Incentives & Recognition"
        subtitle="Performance bonuses, project delivery incentives, and spot awards. All awards require explicit employee acceptance before being credited to payroll."
      />

      {/* Pending acceptance callout for the current employee */}
      {myPending.length > 0 && (
        <section aria-label="Pending incentives" className="space-y-4">
          <h2 className="text-lg font-bold text-ink flex items-center gap-2">
            <span>🎉</span> Action Required: Incentive Awards Waiting for Your Acceptance
          </h2>
          <div className="grid gap-4">
            {myPending.map((inc) => (
              <div
                key={inc.id}
                className="overflow-hidden rounded-2xl border-2 border-brand/40 bg-linear-to-r from-brand/5 via-surface to-surface p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl" aria-hidden>🎁</span>
                      <h3 className="text-xl font-bold text-ink">{inc.title}</h3>
                      <Badge tone="warning">Pending Your Acceptance</Badge>
                    </div>
                    <p className="text-2xl font-black text-brand tabular-nums">
                      {formatPhp(inc.amountCents)}
                    </p>
                    <p className="max-w-2xl text-sm text-ink/80 whitespace-pre-line pt-1">
                      {inc.reason}
                    </p>
                    <p className="text-xs text-muted pt-2">
                      Awarded by <span className="font-semibold text-ink">{who.get(inc.awardedById) ?? "Management"}</span> ·{" "}
                      {formatDay(keyOfDbDate(inc.awardedAt))} {formatTime(inc.awardedAt, tz)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <AcceptIncentiveForm
                      incentiveId={inc.id}
                      title={inc.title}
                      amount={formatPhp(inc.amountCents)}
                    />
                    <DeclineIncentiveForm incentiveId={inc.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Leadership view: Summary stats and Award form */}
      {lead && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total Incentives" value={formatPhp(totalAwardedCents)} />
            <Stat label="Pending Acceptance" value={pendingCount} tone={pendingCount > 0 ? "warning" : undefined} />
            <Stat label="Accepted (Ready for Pay)" value={acceptedCount} tone={acceptedCount > 0 ? "success" : undefined} />
            <Stat label="Paid in Payroll" value={paidCount} />
          </div>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-ink">Award an Incentive 🎁</h3>
                <p className="text-xs text-muted">Grant a performance bonus or spot reward. The employee will be notified to accept it.</p>
              </div>
            </div>
            <AwardIncentiveForm
              employees={eligibleEmployees.map((e) => ({
                id: e.id,
                name: `${e.firstName} ${e.lastName} (${e.employeeNo})`,
              }))}
            />
          </Card>

          {/* All company incentives table */}
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <h3 className="font-semibold text-ink">All Awarded Incentives ({allIncentives.length})</h3>
              <p className="text-xs text-muted">Audit log of all awards & acceptance timestamps</p>
            </div>
            {allIncentives.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No incentives awarded yet" hint="Use the form above to grant the first incentive." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg/60 text-xs font-semibold text-muted">
                    <tr>
                      <th className="px-5 py-3">Employee</th>
                      <th className="px-5 py-3">Incentive</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Awarded By</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Acceptance Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {allIncentives.map((i) => {
                      const badge = STATUS_BADGE[i.status] ?? { label: i.status, tone: "neutral" as const };
                      return (
                        <tr key={i.id} className="hover:bg-bg/40 transition">
                          <td className="px-5 py-3 font-medium">
                            {i.employee.firstName} {i.employee.lastName}
                            <span className="block text-xs text-muted">{i.employee.employeeNo}</span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="font-semibold text-ink">{i.title}</span>
                            <span className="block text-xs text-muted line-clamp-1">{i.reason}</span>
                          </td>
                          <td className="px-5 py-3 font-bold tabular-nums text-brand">
                            {formatPhp(i.amountCents)}
                          </td>
                          <td className="px-5 py-3 text-xs">
                            <span className="font-semibold text-ink">{who.get(i.awardedById) ?? "Management"}</span>
                            <span className="block text-muted">{formatDay(keyOfDbDate(i.awardedAt))}</span>
                          </td>
                          <td className="px-5 py-3">
                            <Badge tone={badge.tone}>{badge.label}</Badge>
                          </td>
                          <td className="px-5 py-3 text-xs text-muted">
                            {i.status === "ACCEPTED" && i.acceptedAt && (
                              <div>
                                <span className="font-semibold text-success">✓ Accepted</span>
                                <span className="block">{formatDay(keyOfDbDate(i.acceptedAt))} {formatTime(i.acceptedAt, tz)}</span>
                                {i.employeeNote && <span className="italic">&ldquo;{i.employeeNote}&rdquo;</span>}
                              </div>
                            )}
                            {i.status === "PAID" && (
                              <span className="text-muted">Credited to payroll</span>
                            )}
                            {i.status === "DECLINED" && i.declinedAt && (
                              <div>
                                <span className="text-danger">Declined</span>
                                <span className="block">{formatDay(keyOfDbDate(i.declinedAt))}</span>
                              </div>
                            )}
                            {i.status === "PENDING" && (
                              <span className="text-warning">Awaiting employee action</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Employee's personal history */}
      <section aria-label="My incentive history">
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h3 className="font-semibold text-ink">My Incentive History ({myCompleted.length})</h3>
          </div>
          {myCompleted.length === 0 ? (
            <div className="p-5">
              <p className="text-sm text-muted">No completed incentive records yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {myCompleted.map((inc) => {
                const badge = STATUS_BADGE[inc.status] ?? { label: inc.status, tone: "neutral" as const };
                return (
                  <li key={inc.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-bg/40">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{inc.title}</span>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </div>
                      <p className="text-sm text-muted">{inc.reason}</p>
                      <p className="text-xs text-muted">
                        Awarded {formatDay(keyOfDbDate(inc.awardedAt))}
                        {inc.acceptedAt && <> · Accepted {formatDay(keyOfDbDate(inc.acceptedAt))} {formatTime(inc.acceptedAt, tz)}</>}
                        {inc.employeeNote && <> · Note: <em>&ldquo;{inc.employeeNote}&rdquo;</em></>}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-brand tabular-nums">
                      {formatPhp(inc.amountCents)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

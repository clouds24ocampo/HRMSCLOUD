import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { isHr } from "@/lib/scope";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { NewRequestForm, RespondForm } from "./RequestForms";
import { REQUEST_CATEGORIES } from "@/lib/labels";

const STATUS = { OPEN: ["Open", "warning"], IN_PROGRESS: ["In progress", "brand"], RESOLVED: ["Resolved", "success"] } as const;

export default async function RequestsPage() {
  const me = await requireUser("/requests");
  const settings = await getOrgSettings(me.organizationId);
  const mine = await getMyEmployee(me, settings.timezone);
  const hr = isHr(me.role.key);
  const when = new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, dateStyle: "medium" });
  const [my, queue] = await Promise.all([
    prisma.hrRequest.findMany({ where: { organizationId: me.organizationId, employeeId: mine.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    hr
      ? prisma.hrRequest.findMany({ where: { organizationId: me.organizationId, status: { not: "RESOLVED" }, employeeId: { not: mine.id } }, include: { employee: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" }, take: 100 })
      : [],
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="HR requests" subtitle="Ask HR for a certificate, a correction or help. You can follow the answer here." />

      {hr && (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Waiting for HR {queue.length > 0 && <Badge tone="warning">{queue.length}</Badge>}</h2>
          {queue.length === 0 ? <p className="text-sm text-muted">Nothing is waiting.</p> : (
            <ul className="space-y-3">
              {queue.map((r) => (
                <li key={r.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{r.subject}</p>
                    <Badge tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge>
                  </div>
                  <p className="text-sm text-muted">{r.employee.firstName} {r.employee.lastName} · {r.category} · {when.format(r.createdAt)}</p>
                  <p className="mt-2 text-sm">{r.message}</p>
                  <RespondForm id={r.id} current={r.response} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">My requests</h2>
          {my.length === 0 ? <EmptyState title="No requests yet" hint="Use the form to ask HR something." /> : (
            <ul className="space-y-3">
              {my.map((r) => (
                <li key={r.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{r.subject}</p>
                    <Badge tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge>
                  </div>
                  <p className="text-sm text-muted">{r.category} · {when.format(r.createdAt)}</p>
                  <p className="mt-2 text-sm">{r.message}</p>
                  {r.response && <p className="mt-2 rounded-lg bg-brand/5 p-3 text-sm"><span className="font-medium">HR: </span>{r.response}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="h-fit">
          <h2 className="mb-3 text-lg font-semibold">Ask HR</h2>
          <NewRequestForm categories={REQUEST_CATEGORIES} />
        </Card>
      </div>
    </div>
  );
}

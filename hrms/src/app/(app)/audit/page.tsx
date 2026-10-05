import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";

const human = (action: string) => {
  const s = action.replace(/[._]/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireUser("/audit");
  const { q } = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const logs = await prisma.auditLog.findMany({
    where: { organizationId: me.organizationId, ...(q?.trim() ? { action: { contains: q.trim(), mode: "insensitive" } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const actors = await prisma.user.findMany({
    where: { organizationId: me.organizationId, id: { in: [...new Set(logs.map((l) => l.actorId).filter((x): x is string => !!x))] } },
    select: { id: true, name: true },
  });
  const name = new Map(actors.map((a) => [a.id, a.name]));
  const when = new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Audit log" subtitle="Who did what, and when. The latest 100 entries. Entries are never edited or deleted." />
      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Filter, for example “leave” or “login”" aria-label="Filter" className={`${inputClass} mt-0 flex-1`} />
        <button className={buttonClass}>Filter</button>
      </form>
      {logs.length === 0 ? (
        <EmptyState title="Nothing recorded yet" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {logs.map((l) => (
              <li key={l.id} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{human(l.action)}</p>
                  <p className="text-xs text-muted">{when.format(l.createdAt)}</p>
                </div>
                <p className="text-sm text-muted">
                  by {l.actorId ? name.get(l.actorId) ?? "a removed user" : "someone not signed in"} · {l.entity}
                </p>
                {l.detail && Object.keys(l.detail as object).length > 0 && (
                  <p className="mt-1 truncate font-mono text-xs text-muted">{JSON.stringify(l.detail)}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

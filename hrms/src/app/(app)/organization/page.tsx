import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { departmentSuggestionsFor, LEVEL_LABEL, positionSuggestionsFor } from "@/lib/defaults";
import { Badge, Card, EmptyState, PageHeader, ghostClass } from "@/components/ui";
import { AddDepartmentForm, AddPositionForm, SuggestionButton } from "./OrgForms";
import { setDepartmentArchived, setPositionArchived } from "./actions";
import { descendantIds } from "@/lib/scope";

type Dept = { id: string; name: string; parentId: string | null; archivedAt: Date | null; _count: { employees: number } };

function flatten(depts: Dept[]) {
  const out: { d: Dept; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const d of depts.filter((x) => x.parentId === parent)) {
      out.push({ d, depth });
      if (depth < 6) walk(d.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export default async function OrganizationPage() {
  const me = await requireUser("/organization");
  const org = me.organization;
  const [depts, positions, heads, everyone] = await Promise.all([
    prisma.department.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true, parentId: true, archivedAt: true, _count: { select: { employees: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.position.findMany({
      where: { organizationId: org.id },
      select: { id: true, title: true, level: true, archivedAt: true, department: { select: { name: true } }, _count: { select: { employees: true } } },
      orderBy: [{ archivedAt: "asc" }, { title: "asc" }],
    }),
    prisma.employee.findMany({
      where: { organizationId: org.id, status: { not: "SEPARATED" }, position: { level: "DEPT_HEAD" } },
      select: { id: true, firstName: true, lastName: true, department: { select: { name: true } }, position: { select: { title: true } }, _count: { select: { reports: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.employee.findMany({ where: { organizationId: org.id, status: { not: "SEPARATED" } }, select: { id: true, managerId: true } }),
  ]);
  const active = depts.filter((d) => !d.archivedAt);
  const archived = depts.filter((d) => d.archivedAt);
  const suggestedDepts = departmentSuggestionsFor(org.categoryKey).filter((n) => !depts.some((d) => d.name === n));
  const posSuggest = positionSuggestionsFor(org.categoryKey).filter((s) => !positions.some((p) => p.title === s.title));
  const levels = Object.entries(LEVEL_LABEL).map(([value, label]) => ({ value, label }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Organization" subtitle="Departments and positions. Employees are placed in these." />
      <Card className="mb-6 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Department heads</h2>
          <p className="text-sm text-muted">Everyone in a position at the Department head level. Open one to see their assistants and everyone below them.</p>
        </div>
        {heads.length === 0 ? (
          <EmptyState title="No department heads yet" hint="Give a position the Department head level, then assign it to someone on their employee page." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {heads.map((h) => (
              <li key={h.id}>
                <Link href={`/organization/heads/${h.id}`} className="block rounded-xl border border-line p-4 transition hover:border-brand hover:bg-brand/5">
                  <p className="font-semibold">{h.firstName} {h.lastName}</p>
                  <p className="text-sm text-muted">{h.position?.title}{h.department ? ` · ${h.department.name}` : ""}</p>
                  <p className="mt-2 text-xs text-muted">{h._count.reports} direct · {descendantIds(everyone, h.id).length - 1} in total below</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-5">
          <h2 className="text-lg font-semibold">Departments</h2>
          {active.length === 0 ? (
            <EmptyState title="No departments yet" hint="Add one below, or use the suggestions." />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {flatten(active).map(({ d, depth }) => (
                <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2.5" style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}>
                  <span className="min-w-0 truncate font-medium">{depth > 0 && <span className="text-muted">↳ </span>}{d.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge>{d._count.employees} {d._count.employees === 1 ? "person" : "people"}</Badge>
                    <form action={setDepartmentArchived.bind(null, d.id, true)}>
                      <button className={ghostClass} aria-label={`Archive ${d.name}`}>Archive</button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <SuggestionButton kind="departments" departments={suggestedDepts} />
          <AddDepartmentForm departments={active.map((d) => ({ id: d.id, name: d.name }))} />
          {archived.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-muted">Archived ({archived.length})</summary>
              <ul className="mt-2 space-y-1">
                {archived.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2 text-sm text-muted">
                    {d.name}
                    <form action={setDepartmentArchived.bind(null, d.id, false)}>
                      <button className={ghostClass}>Restore</button>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>

        <Card className="space-y-5">
          <h2 className="text-lg font-semibold">Positions</h2>
          {positions.filter((p) => !p.archivedAt).length === 0 ? (
            <EmptyState title="No positions yet" hint="Add one below, or use the suggestions." />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {positions.filter((p) => !p.archivedAt).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.title}</p>
                    <p className="truncate text-xs text-muted">{LEVEL_LABEL[p.level]}{p.department ? ` · ${p.department.name}` : ""}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge>{p._count.employees}</Badge>
                    <form action={setPositionArchived.bind(null, p.id, true)}>
                      <button className={ghostClass} aria-label={`Archive ${p.title}`}>Archive</button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <SuggestionButton kind="positions" positions={posSuggest} />
          <AddPositionForm departments={active.map((d) => ({ id: d.id, name: d.name }))} levels={levels} />
          {positions.some((p) => p.archivedAt) && (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-muted">Archived ({positions.filter((p) => p.archivedAt).length})</summary>
              <ul className="mt-2 space-y-1">
                {positions.filter((p) => p.archivedAt).map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2 text-sm text-muted">
                    {p.title}
                    <form action={setPositionArchived.bind(null, p.id, false)}>
                      <button className={ghostClass}>Restore</button>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      </div>
    </div>
  );
}

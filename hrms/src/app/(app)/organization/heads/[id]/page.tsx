import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { LEVEL_LABEL } from "@/lib/defaults";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

type Person = { id: string; firstName: string; lastName: string; managerId: string | null; departmentId: string | null; position: { title: string; level: keyof typeof LEVEL_LABEL } | null; department: { name: string } | null };

// The downline as a nested list. Depth is capped so a bad loop in the data can never hang the page.
function Tree({ people, parentId, depth }: { people: Person[]; parentId: string; depth: number }) {
  const kids = people.filter((p) => p.managerId === parentId);
  if (!kids.length || depth > 12) return null;
  return (
    <ul className={depth ? "mt-1 space-y-1 border-l border-line pl-4" : "space-y-1"}>
      {kids.map((k) => (
        <li key={k.id}>
          <Link href={`/employees/${k.id}`} className="text-sm font-medium hover:underline">{k.firstName} {k.lastName}</Link>
          <span className="text-xs text-muted"> · {k.position?.title ?? "No position"}{k.department ? ` · ${k.department.name}` : ""}</span>
          <Tree people={people} parentId={k.id} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

export default async function DepartmentHeadPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser("/organization");
  const { id } = await params;
  const people: Person[] = await prisma.employee.findMany({
    where: { organizationId: me.organizationId, status: { not: "SEPARATED" } },
    select: { id: true, firstName: true, lastName: true, managerId: true, departmentId: true, position: { select: { title: true, level: true } }, department: { select: { name: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const head = people.find((p) => p.id === id);
  if (!head) notFound();
  const direct = people.filter((p) => p.managerId === head.id);
  // Assistants: assistant heads of the same department, plus direct reports in a leading role (team leader or manager).
  const assistants = people.filter((p) => p.id !== head.id && p.position && ((p.position.level === "ASSISTANT_HEAD" && (p.departmentId === head.departmentId || p.managerId === head.id)) || (p.managerId === head.id && (p.position.level === "TEAM_LEAD" || p.position.level === "MANAGER"))));
  const others = direct.filter((p) => !assistants.includes(p));

  const row = (p: Person) => (
    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
      <Link href={`/employees/${p.id}`} className="font-medium hover:underline">{p.firstName} {p.lastName}</Link>
      <span className="text-sm text-muted">{p.position ? `${p.position.title} (${LEVEL_LABEL[p.position.level]})` : "No position"}</span>
    </li>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/organization" className="text-sm font-medium text-muted hover:text-ink">← Organization</Link>
      <PageHeader
        title={`${head.firstName} ${head.lastName}`}
        subtitle={`${head.position?.title ?? "No position"}${head.department ? ` · ${head.department.name}` : ""}`}
        action={<Link href={`/employees/${head.id}`} className="rounded-lg border border-line px-4 py-2.5 font-semibold transition hover:bg-bg">Profile</Link>}
      />
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Assistants <Badge>{assistants.length}</Badge></h2>
        {assistants.length === 0 ? <p className="text-sm text-muted">No assistant head, team leader or manager under this head yet.</p> : <ul className="divide-y divide-line rounded-xl border border-line">{assistants.map(row)}</ul>}
      </Card>
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Other direct reports <Badge>{others.length}</Badge></h2>
        {others.length === 0 ? <p className="text-sm text-muted">None.</p> : <ul className="divide-y divide-line rounded-xl border border-line">{others.map(row)}</ul>}
      </Card>
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Whole downline</h2>
        {direct.length === 0 ? <EmptyState title="Nobody reports to this head yet" hint="Set the immediate supervisor on each employee's page." /> : <Tree people={people} parentId={head.id} depth={0} />}
      </Card>
    </div>
  );
}

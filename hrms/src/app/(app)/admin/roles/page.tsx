import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { orgRoles } from "@/lib/access";
import { rolePerms, ROLE_TEMPLATES } from "@/lib/permissions";
import { Badge, PageHeader } from "@/components/ui";
import { CreateRoleForm } from "./RoleForms";

export default async function RolesPage() {
  const me = await requireUser("/admin/roles");
  const roles = await orgRoles(me.organizationId);
  const counts = await prisma.user.groupBy({ by: ["roleId"], where: { organizationId: me.organizationId }, _count: { _all: true } });
  const people = new Map(counts.map((c) => [c.roleId, c._count._all]));
  const have = new Set(roles.map((r) => r.name.toLowerCase()));

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="min-w-0 space-y-4">
        <PageHeader title="Roles" subtitle="A role is a starting set of access. Built-in roles are fixed; make your own to fit your company, then fine-tune any one account from Users." />
        <p className="text-sm"><Link href="/admin/users" className="font-medium text-brand hover:underline">← Users</Link></p>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          {roles.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/roles/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="truncate text-sm text-muted">{r.description ?? (r.organizationId ? "Company role" : "Built-in role")}</p>
                </div>
                <span className="flex shrink-0 items-center gap-2 text-sm">
                  <Badge tone={r.organizationId ? "brand" : "neutral"}>{r.organizationId ? "Company role" : "Built-in"}</Badge>
                  <span className="text-muted">{rolePerms(r).length} permissions · {people.get(r.id) ?? 0} {(people.get(r.id) ?? 0) === 1 ? "person" : "people"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <aside className="lg:order-2">
        <CreateRoleForm
          roles={roles.map((r) => ({ id: r.id, name: r.name }))}
          templates={ROLE_TEMPLATES.filter((t) => !have.has(t.name.toLowerCase())).map((t) => ({ name: t.name, description: t.description }))}
        />
      </aside>
    </div>
  );
}

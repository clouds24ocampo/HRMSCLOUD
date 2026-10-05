import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { listOrgUsers } from "@/lib/users";
import { Badge } from "@/components/ui";
import { CreateUserForm } from "./CreateUserForm";
import { UserManage } from "./UserManage";

export default async function UsersPage() {
  const me = await requireUser("/admin/users");
  const [users, roles] = await Promise.all([
    listOrgUsers(me.organizationId),
    prisma.role.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="min-w-0 lg:order-1">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="mb-4 mt-1 text-sm text-muted">Sign-ins and roles. To add a person with a full employee record, use Employees and tick “create a sign-in”.</p>
        {users.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-muted">No users yet. Add the first one.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            {users.map((u) => (
              <li key={u.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden hover:bg-bg">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.name}{u.id === me.id && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}</p>
                      <p className="truncate text-sm text-muted">{u.email}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      {!u.active && <Badge tone="danger">Deactivated</Badge>}
                      {u.mustChangePassword && u.active && <Badge tone="warning">Temporary password</Badge>}
                      <Badge tone="brand">{u.role.name}</Badge>
                      {u.id !== me.id && <span className="text-muted transition group-open:rotate-90" aria-hidden>▸</span>}
                    </span>
                  </summary>
                  {u.id !== me.id && <UserManage user={u} roles={roles} />}
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside className="lg:order-2">
        <CreateUserForm roles={roles} />
      </aside>
    </div>
  );
}

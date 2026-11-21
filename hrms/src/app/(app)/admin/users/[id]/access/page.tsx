import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { orgRoles } from "@/lib/access";
import { LEVEL_ROLE_NAME, rolePerms, suggestRole, effectivePerms, type Level } from "@/lib/permissions";
import { Badge, PageHeader } from "@/components/ui";
import { AccessEditor } from "./AccessEditor";

export default async function AccessPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser("/admin/users");
  const { id } = await params;
  const u = await prisma.user.findFirst({
    where: { id, organizationId: me.organizationId },
    select: { id: true, name: true, email: true, roleId: true, grants: true, revokes: true, role: { select: { key: true, permissions: true } }, employee: { select: { id: true, employeeNo: true, position: { select: { title: true, level: true } } } } },
  });
  if (!u) notFound();
  const roles = await orgRoles(me.organizationId);
  const level = (u.employee?.position?.level as Level | undefined) ?? null;
  const suggested = suggestRole(level, roles);
  const eff = effectivePerms(u.role, u.grants, u.revokes);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/admin/users" className="text-sm font-medium text-brand hover:underline">← Users</Link>
      <PageHeader title={`Access: ${u.name}`} subtitle={u.email} />
      <p className="flex flex-wrap items-center gap-2 text-sm">
        {u.employee ? <Badge tone="neutral">{u.employee.employeeNo}</Badge> : <Badge tone="neutral">No employee record</Badge>}
        {u.employee?.position ? <Badge tone="brand">{u.employee.position.title} · {LEVEL_ROLE_NAME[level!]} level</Badge> : <Badge tone="neutral">No position</Badge>}
        <span className="text-muted">{eff.size} permissions now</span>
      </p>
      {u.id === me.id ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-muted">You cannot change your own access. Ask another Super Admin.</p>
      ) : (
        <AccessEditor
          userId={u.id}
          roles={roles.map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, perms: rolePerms(r), mine: !!r.organizationId }))}
          roleId={u.roleId}
          perms={[...eff]}
          suggestedId={suggested?.id ?? null}
          level={level ? LEVEL_ROLE_NAME[level] : null}
          entry={level === "ENTRY"}
        />
      )}
    </div>
  );
}

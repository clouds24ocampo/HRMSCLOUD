import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isBuiltInRole, rolePerms } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { RoleEditor } from "../RoleForms";

export default async function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser("/admin/roles");
  const { id } = await params;
  const role = await prisma.role.findFirst({
    where: { id, key: { not: "APPLICANT" }, OR: [{ organizationId: null }, { organizationId: me.organizationId }] },
    include: { _count: { select: { users: { where: { organizationId: me.organizationId } } } } },
  });
  if (!role) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/admin/roles" className="text-sm font-medium text-brand hover:underline">← Roles</Link>
      <PageHeader title={role.name} subtitle={isBuiltInRole(role.key) ? "Built-in role" : "Company role"} />
      <RoleEditor
        id={role.id}
        name={role.name}
        description={role.description ?? ""}
        perms={rolePerms(role)}
        editable={!isBuiltInRole(role.key)}
        people={role._count.users}
      />
    </div>
  );
}

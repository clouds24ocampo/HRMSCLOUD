import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { csv, csvResponse } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { isHr } from "@/lib/scope";
import { getOrgSettings } from "@/lib/settings";
import { dayKey, formatTime } from "@/lib/time";

export async function GET() {
  const me = await requireUser("/reports");
  if (!isHr(me.role.key)) {
    return new Response("Only HR and administrators can export document compliance reports.", { status: 403 });
  }

  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const today = dayKey(new Date(), tz);

  const [docs, users] = await Promise.all([
    prisma.employeeDocument.findMany({
      where: { organizationId: me.organizationId },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeNo: true, department: { select: { name: true } } } },
      },
      orderBy: [{ employee: { lastName: "asc" } }, { title: "asc" }, { version: "desc" }],
    }),
    prisma.user.findMany({
      where: { organizationId: me.organizationId },
      select: { id: true, name: true },
    }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const stamp = (d: Date | null) => (d ? `${dayKey(d, tz)} ${formatTime(d, tz)}` : "");

  await audit(me.id, "reports.documents_exported", "EmployeeDocument", "all", { count: docs.length }, me.organizationId);

  const header = [
    "Employee",
    "Employee No",
    "Department",
    "Document Title",
    "Category",
    "File Name",
    "Version",
    "Uploaded By",
    "Uploaded At",
    "Status",
    "Archived At",
    "Expires On",
  ];

  const rows = docs.map((d) => {
    const isArchived = !!d.archivedAt;
    const isExpired = d.expiresOn && dayKey(d.expiresOn, tz) < today;
    const status = isArchived ? "Archived" : isExpired ? "Expired" : "Active";
    return [
      `${d.employee.lastName}, ${d.employee.firstName}`,
      d.employee.employeeNo,
      d.employee.department?.name ?? "None",
      d.title,
      d.category,
      d.fileName,
      `v${d.version}`,
      d.uploadedById ? userMap.get(d.uploadedById) ?? "Former User" : "System",
      stamp(d.createdAt),
      status,
      stamp(d.archivedAt),
      d.expiresOn ? dayKey(d.expiresOn, tz) : "",
    ];
  });

  const file = `document-requirements-report-${today}.csv`;
  return csvResponse(file, csv([header, ...rows]));
}

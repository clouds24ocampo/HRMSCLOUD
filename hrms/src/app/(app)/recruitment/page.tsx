import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { AddJobForm } from "./RecruitmentForms";

export default async function RecruitmentPage() {
  const me = await requireUser("/recruitment");
  const [jobs, departments, positions] = await Promise.all([
    prisma.jobPosting.findMany({
      where: { organizationId: me.organizationId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { department: { select: { name: true } }, applicants: { select: { stage: true } } },
    }),
    prisma.department.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.position.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Recruitment" subtitle="Open a job, track applicants through the stages, then hire. The hire becomes an employee record without retyping." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {jobs.length === 0 ? (
            <EmptyState title="No jobs yet" hint="Open the first job with the form." />
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-line">
                {jobs.map((j) => {
                  const active = j.applicants.filter((a) => !["HIRED", "REJECTED"].includes(a.stage)).length;
                  const hired = j.applicants.filter((a) => a.stage === "HIRED").length;
                  return (
                    <li key={j.id}>
                      <Link href={`/recruitment/${j.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 transition hover:bg-bg">
                        <div className="min-w-0">
                          <p className="font-medium">{j.title}</p>
                          <p className="text-sm text-muted">{j.department?.name ?? "Any department"} · {j.openings} opening{j.openings === 1 ? "" : "s"} · {hired} hired</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge>{active} in progress</Badge>
                          <Badge tone={j.status === "OPEN" ? "success" : "neutral"}>{j.status === "OPEN" ? "Open" : "Closed"}</Badge>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
        <Card className="h-fit">
          <h2 className="mb-3 text-lg font-semibold">Open a job</h2>
          <AddJobForm departments={departments.map((d) => ({ id: d.id, label: d.name }))} positions={positions.map((p) => ({ id: p.id, label: p.title }))} />
        </Card>
      </div>
    </div>
  );
}

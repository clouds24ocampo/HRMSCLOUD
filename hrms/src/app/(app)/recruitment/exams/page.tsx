import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { KIND_LABEL } from "@/lib/exams";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { CreateExamForm } from "./ExamForms";
import { RecruitmentTabs } from "../RecruitmentTabs";

export default async function ExamsPage() {
  const me = await requireUser("/recruitment");
  const [exams, jobs] = await Promise.all([
    prisma.exam.findMany({
      where: { organizationId: me.organizationId },
      orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
      include: { job: { select: { title: true } }, _count: { select: { questions: true, attempts: true } } },
    }),
    prisma.jobPosting.findMany({ where: { organizationId: me.organizationId }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Recruitment" subtitle="Applicants upload their resume and ID first. Then they take the psychological exam, then the position exam. Exams with no questions are skipped." />
      <RecruitmentTabs />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {exams.length === 0 ? (
            <EmptyState title="No exams yet" hint="Create the first exam with the form, then add its questions." />
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-line">
                {exams.map((e) => (
                  <li key={e.id}>
                    <Link href={`/recruitment/exams/${e.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 transition hover:bg-bg">
                      <div className="min-w-0">
                        <p className="font-medium">{e.title}</p>
                        <p className="text-sm text-muted">{e.job?.title ?? "Every position"} · {e._count.questions} questions · {e.timeLimitMin} min · taken {e._count.attempts}×</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone="brand">{KIND_LABEL[e.kind]}</Badge>
                        <Badge tone={e.active && e._count.questions > 0 ? "success" : "neutral"}>{!e.active ? "Off" : e._count.questions === 0 ? "No questions" : "On"}</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <Card className="h-fit">
          <h2 className="mb-3 text-lg font-semibold">New exam</h2>
          <CreateExamForm jobs={jobs.map((j) => ({ id: j.id, label: j.title }))} />
        </Card>
      </div>
    </div>
  );
}

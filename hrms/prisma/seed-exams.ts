// Loads the ready-made applicant exams: 30 knowledge questions per starter position and one 30-question
// psychological exam for every position. Safe to run again: a position that already has questions is left alone,
// and an existing empty exam is filled instead of duplicated.
//   npm run exams:seed                  first organization
//   npm run exams:seed -- --no-translate   skip the Tagalog pre-translation (it also happens when an applicant starts)
import { db } from "../src/lib/db-client";
import { KNOWLEDGE_BANK, PSYCH, roleFields, knowledgeOptions, psychOptions } from "../src/lib/exam-bank";
import { ensureTagalog } from "../src/lib/translate";

async function examFor(organizationId: string, jobId: string | null, kind: "KNOWLEDGE" | "PSYCHOLOGICAL", title: string, passingPct: number | null) {
  const found = await db.exam.findMany({ where: { organizationId, jobId, kind }, include: { _count: { select: { questions: true } } }, orderBy: { createdAt: "asc" } });
  if (found.some((e) => e._count.questions > 0)) return { exam: found.find((e) => e._count.questions > 0)!, fresh: false };
  const empty = found[0];
  if (empty) return { exam: empty, fresh: true };
  const exam = await db.exam.create({ data: { organizationId, jobId, kind, title, timeLimitMin: 60, passingPct } });
  return { exam, fresh: true };
}

async function main() {
  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("No organization yet. Register one first.");
  const translate = !process.argv.includes("--no-translate");
  const touched: string[] = [];

  let jobs = await db.jobPosting.findMany({ where: { organizationId: org.id } });
  // Positions that do not exist yet are opened first, so the exams always have a position to belong to.
  for (const title of Object.keys(KNOWLEDGE_BANK)) {
    if (jobs.some((j) => j.title.toLowerCase() === title.toLowerCase())) continue;
    await db.jobPosting.create({ data: { organizationId: org.id, title, openings: 1, status: "OPEN", ...roleFields(title) } });
    console.log(`opened ${title}`);
    jobs = await db.jobPosting.findMany({ where: { organizationId: org.id } });
  }
  // Positions made before role descriptions existed get them now. A job that already has duties is left as HR wrote it.
  for (const j of jobs) {
    const f = roleFields(j.title);
    if (f && !j.duties) { await db.jobPosting.update({ where: { id: j.id }, data: f }); console.log(`role   ${j.title}: description and duties added`); }
  }
  jobs = await db.jobPosting.findMany({ where: { organizationId: org.id } });
  for (const [title, bank] of Object.entries(KNOWLEDGE_BANK)) {
    const job = jobs.find((j) => j.title.toLowerCase() === title.toLowerCase());
    if (!job) { console.log(`skip   ${title}: no such position`); continue; }
    const { exam, fresh } = await examFor(org.id, job.id, "KNOWLEDGE", `${title} Knowledge Exam`, 60);
    if (!fresh) { console.log(`keep   ${title}: already has questions`); continue; }
    await db.examQuestion.createMany({ data: bank.map((q, i) => ({ examId: exam.id, text: q[0], options: knowledgeOptions(q, i, job.title.length), sort: i + 1 })) });
    touched.push(exam.id);
    console.log(`added  ${title}: ${bank.length} questions`);
  }

  const { exam: psych, fresh } = await examFor(org.id, null, "PSYCHOLOGICAL", "Work Mindset (Psychological) Exam", null);
  if (fresh) {
    await db.examQuestion.createMany({ data: PSYCH.map((q, i) => ({ examId: psych.id, text: q[1], trait: q[0], options: psychOptions(q, i), sort: i + 1 })) });
    touched.push(psych.id);
    console.log(`added  psychological exam for every position: ${PSYCH.length} questions`);
  } else console.log("keep   psychological exam: already has questions");

  if (translate) {
    for (const id of touched) {
      await ensureTagalog(id);
      console.log(`tagalog ${id}`);
    }
  }
}

main().then(() => db.$disconnect(), (e) => { console.error(e); process.exit(1); });

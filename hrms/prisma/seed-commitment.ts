// Adds the first exam, "Corporate Commitment", for every position. Safe to run again: if the organization
// already has a commitment exam (even an edited one), nothing is added. Tagalog is translated when an applicant first starts it.
//   npm run commitment:seed
//   npm run commitment:seed -- --refresh   replace the questions of the existing exam with the ones in the code; refused once anyone has taken it
import { db } from "../src/lib/db-client";
import { COMMITMENT, COMMITMENT_INSTRUCTIONS, COMMITMENT_TITLE, psychOptions } from "../src/lib/exam-bank";

async function main() {
  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("No organization yet. Register one first.");
  const have = await db.exam.findFirst({ where: { organizationId: org.id, kind: "COMMITMENT" }, include: { _count: { select: { attempts: true } } } });
  if (have && !process.argv.includes("--refresh")) return console.log("keep   commitment exam: already exists");
  if (have && have._count.attempts > 0) throw new Error("Refused: applicants already took the commitment exam. Their answers would no longer match the questions.");
  if (have) await db.examQuestion.deleteMany({ where: { examId: have.id } });
  const exam = have
    ? await db.exam.update({ where: { id: have.id }, data: { title: COMMITMENT_TITLE, instructions: COMMITMENT_INSTRUCTIONS } })
    : await db.exam.create({ data: { organizationId: org.id, jobId: null, kind: "COMMITMENT", title: COMMITMENT_TITLE, instructions: COMMITMENT_INSTRUCTIONS, timeLimitMin: 60, passingPct: null } });
  await db.examQuestion.createMany({ data: COMMITMENT.map((q, i) => ({ examId: exam.id, text: q[1], trait: q[0], options: psychOptions(q, i), sort: i + 1 })) });
  console.log(`${have ? "replaced" : "added"} commitment exam for every position: ${COMMITMENT.length} questions`);
}
main().then(() => db.$disconnect(), (e) => { console.error(e); process.exit(1); });

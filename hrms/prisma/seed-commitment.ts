// Adds the third exam, "Corporate Commitment & Loyalty", for every position. Safe to run again: if the organization
// already has a commitment exam (even an edited one), nothing is added. Tagalog is translated when an applicant first starts it.
//   npm run commitment:seed
import { db } from "../src/lib/db-client";
import { COMMITMENT, COMMITMENT_INSTRUCTIONS, COMMITMENT_TITLE, psychOptions } from "../src/lib/exam-bank";

async function main() {
  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("No organization yet. Register one first.");
  if ((await db.exam.count({ where: { organizationId: org.id, kind: "COMMITMENT" } })) > 0) return console.log("keep   commitment exam: already exists");
  const exam = await db.exam.create({ data: { organizationId: org.id, jobId: null, kind: "COMMITMENT", title: COMMITMENT_TITLE, instructions: COMMITMENT_INSTRUCTIONS, timeLimitMin: 60, passingPct: null } });
  await db.examQuestion.createMany({ data: COMMITMENT.map((q, i) => ({ examId: exam.id, text: q[1], trait: q[0], options: psychOptions(q, i), sort: i + 1 })) });
  console.log(`added  commitment exam for every position: ${COMMITMENT.length} questions`);
}
main().then(() => db.$disconnect(), (e) => { console.error(e); process.exit(1); });

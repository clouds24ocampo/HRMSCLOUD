// Runs on every start (see the Dockerfile). The first time an organization exists and has no exams yet, it loads the
// recruitment starter set: the IT positions, the ready-made exams and the role descriptions. It also adds the commitment exam
// once if it is missing. After that it does nothing, so it never touches positions or exams that HR has changed. Tagalog is translated when an applicant first starts an exam.
import { execFileSync } from "node:child_process";
import { db } from "../src/lib/db-client";

async function main() {
  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) return console.log("recruitment seed: no organization yet, skipped");
  const first = (await db.exam.count({ where: { organizationId: org.id } })) === 0;
  const hasCommitment = (await db.exam.count({ where: { organizationId: org.id, kind: "COMMITMENT" } })) > 0;
  if (!first && hasCommitment) return console.log("recruitment seed: nothing to add, skipped");
  await db.$disconnect();
  const run = (...args: string[]) => execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", ...args], { stdio: "inherit" }); // fixed arguments only, no shell
  if (first) {
    run("prisma/seed-exams.ts", "--no-translate"); // opens the positions, adds role descriptions and exams
    run("prisma/seed-org.ts"); // IT departments and positions, links the jobs to them
  }
  run("prisma/seed-commitment.ts"); // the commitment exam, taken first; added to an install that already had the other two
  console.log("recruitment seed: done");
}

main().then(() => db.$disconnect(), (e) => { console.error(e); process.exit(1); });

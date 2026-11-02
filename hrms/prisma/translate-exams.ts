// Pre-translates every exam question and every position description that has no Tagalog yet, so nobody waits.
//   npm run exams:translate
import { db } from "../src/lib/db-client";
import { ensureTagalog, translateToTagalog } from "../src/lib/translate";

const NL = String.fromCharCode(10);

async function main() {
  const exams = await db.exam.findMany({ where: { questions: { some: { textTl: null } } }, select: { id: true, title: true } });
  for (const e of exams) {
    await ensureTagalog(e.id);
    const left = await db.examQuestion.count({ where: { examId: e.id, textTl: null } });
    console.log(`${left === 0 ? "done  " : `${left} left`} ${e.title}`);
  }

  // Positions written by HR in English only.
  const jobs = await db.jobPosting.findMany({ where: { OR: [{ descriptionTl: null, description: { not: null } }, { dutiesTl: null, duties: { not: null } }] } });
  for (const j of jobs) {
    const duties = (j.duties ?? "").split(NL).filter(Boolean);
    const tl = await translateToTagalog([...(j.description ? [j.description] : []), ...duties]);
    if (!tl) { console.log(`failed ${j.title}`); continue; }
    const [first, ...rest] = tl;
    await db.jobPosting.update({ where: { id: j.id }, data: { descriptionTl: j.description ? first : j.descriptionTl, dutiesTl: duties.length ? (j.description ? rest : tl).join(NL) : j.dutiesTl } });
    console.log(`done   position ${j.title}`);
  }
}

main().then(() => db.$disconnect(), (e) => { console.error(e); process.exit(1); });

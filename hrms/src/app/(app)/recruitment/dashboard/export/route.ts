import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getOrgSettings } from "@/lib/settings";
import { drillApps, drillTitle, groupByPerson, parseDrill } from "@/lib/recruitment-drill";
import { loadRecruitment, rangeOf } from "@/lib/recruitment-data";
import { csv, csvResponse } from "@/lib/csv";
import { STAGE_LABEL } from "@/lib/stages";
import { dayKey } from "@/lib/time";

// One row per applicant, with everything the dashboard knows. No kind in the link means everyone in the period.
// Personal data leaves the system here, so each download is written to the audit log.
export async function GET(req: Request) {
  const me = await requireUser("/recruitment");
  const u = new URL(req.url).searchParams;
  const range = rangeOf(u.get("range") ?? undefined);
  const drill = parseDrill({ kind: u.get("kind") ?? undefined, value: u.get("value") ?? undefined, stage: u.get("stage") ?? undefined });
  const settings = await getOrgSettings(me.organizationId);
  const { jobs, apps } = await loadRecruitment(me.organizationId, range);
  const rows = drillApps(apps, drill, settings.timezone);
  const people = groupByPerson(rows, apps);
  const pct = (n: number | null) => (n === null ? "" : n);
  // One row per applicant. Their positions and stages sit together in one cell, for example "Cloud Engineer (Screening); Office Staff (Applied)".
  const body = csv([
    ["Applicant no.", "Name", "Email", "Phone", "Positions and stages", "Applications", "First applied", "Resume uploaded", "Valid ID uploaded", "Psychological %", "Best combined %", "Exam language", "Detail"],
    ...people.map((p) => {
      const lang = [...new Set(p.apps.flatMap(({ app }) => app.attempts.filter((t) => t.submittedAt).map((t) => (t.lang === "tl" ? "Tagalog" : "English"))))].join(" / ");
      return [p.applicantNo ?? "", p.name, p.email ?? "", p.phone ?? "", p.apps.map(({ app }) => `${app.jobTitle} (${STAGE_LABEL[app.stage]})`).join("; "), p.apps.length, dayKey(p.firstApplied, settings.timezone), p.hasResume ? "Yes" : "No", p.hasId ? "Yes" : "No", pct(p.psychological), pct(p.bestCombined), lang, p.note ?? ""];
    }),
  ]);
  await audit(me.id, "recruitment.exported", "Applicant", undefined, { list: drillTitle(drill, apps, jobs), applicants: people.length, applications: rows.length }, me.organizationId);
  return csvResponse(`applicants-${range}-${dayKey(new Date(), settings.timezone)}.csv`, body);
}

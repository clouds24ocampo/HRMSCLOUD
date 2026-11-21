import Link from "next/link";

export const STAGE_TABS = [
  ["applied", "APPLIED", "Applied", "Creating their account, uploading the resume and valid ID, taking the exams."],
  ["screening", "SCREENING", "Screening", "Exams are in. HR reviews the results and decides who gets an interview."],
  ["interview", "INTERVIEW", "Interview", "Set the interview date and hold it. Move the person on when they pass."],
  ["requirements", "REQUIREMENTS", "Requirements", "Passed the interview. They upload the 201 file documents HR needs."],
  ["offer", "OFFER", "Orientation & contract", "Requirements are complete. They attend orientation, sign the policies and the contract. Then HR hires."],
  ["hired", "HIRED", "Hired", "Now on the team, as an employee or a subcontractor."],
] as const;
export type StageSlug = (typeof STAGE_TABS)[number][0];

// The row of stages under the Pipeline tab, each with how many people are in it.
export function StageTabs({ active, counts }: { active: StageSlug; counts: Record<string, number> }) {
  return (
    <nav aria-label="Stages" className="mb-5 flex gap-2 overflow-x-auto pb-1">
      {STAGE_TABS.map(([slug, key, label]) => {
        const on = slug === active;
        return (
          <Link
            key={slug} href={`/recruitment/pipeline/${slug}`} aria-current={on ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${on ? "border-brand bg-brand text-brand-ink shadow-sm" : "border-line bg-surface text-muted hover:border-brand/50 hover:text-ink"}`}
          >
            {label}
            <span className={`rounded-full px-2 py-0.5 text-xs ${on ? "bg-white/25" : "bg-line"}`}>{counts[key] ?? 0}</span>
          </Link>
        );
      })}
    </nav>
  );
}

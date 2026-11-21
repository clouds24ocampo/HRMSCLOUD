// How far along an applicant is INSIDE their current stage, as a percent, and what is still missing before HR moves them on.
// Pure, so the stage tabs, the tests and any future screen use one definition.
//
//   Applied       account, resume and valid ID, every exam handed in
//   Screening     exams handed in and documents in (HR reviews the results)
//   Interview     interview scheduled, then held
//   Requirements  the required 201 file documents
//   Orientation & contract   company policies signed, contract sent, contract signed
import type { ContractState } from "@/lib/hiring-pipeline";

export type BoardStage = "APPLIED" | "SCREENING" | "INTERVIEW" | "REQUIREMENTS" | "OFFER";
export const BOARD_STAGES: BoardStage[] = ["APPLIED", "SCREENING", "INTERVIEW", "REQUIREMENTS", "OFFER"];
export const NEXT_STAGE: Record<BoardStage, Exclude<BoardStage, "APPLIED"> | "HIRE"> = { APPLIED: "SCREENING", SCREENING: "INTERVIEW", INTERVIEW: "REQUIREMENTS", REQUIREMENTS: "OFFER", OFFER: "HIRE" };

export type StageInput = {
  stage: BoardStage;
  hasAccount: boolean;
  docsUploaded: boolean; // resume and valid ID
  exams: { required: number; done: number };
  interviewAt: Date | null;
  now: Date;
  requirements: { done: number; total: number } | null;
  policies: { total: number; signed: number };
  contract: ContractState;
};
export type StageItem = { label: string; done: boolean; detail: string };
export type StageProgress = { pct: number; items: StageItem[]; ready: boolean; missing: string[] };

const pct = (done: number, total: number) => (total <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((done / total) * 100))));

export function stageProgress(i: StageInput): StageProgress {
  const examsDone = Math.min(i.exams.done, i.exams.required);
  const examItem: StageItem = { label: "Exams handed in", done: examsDone >= i.exams.required && (i.exams.required > 0 || i.hasAccount), detail: i.exams.required === 0 ? "No exam for this position" : `${examsDone} of ${i.exams.required}` };
  const docsItem: StageItem = { label: "Resume and valid ID", done: i.docsUploaded, detail: i.docsUploaded ? "Both in" : "Not uploaded yet" };
  let items: StageItem[];
  let value: number;
  let total: number;

  switch (i.stage) {
    case "APPLIED":
      items = [{ label: "Applicant account", done: i.hasAccount, detail: i.hasAccount ? "Can sign in" : "No account yet" }, docsItem, examItem];
      value = (i.hasAccount ? 1 : 0) + (i.docsUploaded ? 1 : 0) + examsDone; total = 2 + i.exams.required;
      break;
    case "SCREENING":
      items = [examItem, docsItem];
      value = examsDone + (i.docsUploaded ? 1 : 0); total = i.exams.required + 1;
      break;
    case "INTERVIEW": {
      const scheduled = !!i.interviewAt, held = !!i.interviewAt && i.interviewAt.getTime() <= i.now.getTime();
      items = [{ label: "Interview scheduled", done: scheduled, detail: scheduled ? "Date set" : "No date yet" }, { label: "Interview held", done: held, detail: held ? "Done" : scheduled ? "Not yet" : "After it is scheduled" }];
      value = (scheduled ? 1 : 0) + (held ? 1 : 0); total = 2;
      break;
    }
    case "REQUIREMENTS": {
      const r = i.requirements;
      items = [{ label: "Required 201 file documents", done: !!r && r.done >= r.total, detail: r ? `${r.done} of ${r.total}` : "Needs an applicant account to upload" }];
      value = r ? Math.min(r.done, r.total) : 0; total = r ? r.total : 1;
      break;
    }
    case "OFFER": {
      const signed = Math.min(i.policies.signed, i.policies.total);
      items = [
        ...(i.policies.total > 0 ? [{ label: "Company policies signed", done: signed >= i.policies.total, detail: `${signed} of ${i.policies.total}` }] : []),
        { label: "Contract sent", done: i.contract !== "NONE", detail: i.contract === "NONE" ? "Not sent yet" : "Sent" },
        { label: "Contract signed", done: i.contract === "SIGNED", detail: i.contract === "SIGNED" ? "Signed" : "Waiting" },
      ];
      value = signed + (i.contract !== "NONE" ? 1 : 0) + (i.contract === "SIGNED" ? 1 : 0); total = i.policies.total + 2;
      break;
    }
  }
  const missing = items.filter((x) => !x.done).map((x) => x.label);
  return { pct: pct(value, total), items, ready: missing.length === 0, missing };
}

// Tone for the bar: green when complete, amber when more than half, red when it has barely started.
export const progressTone = (p: number): "success" | "warning" | "danger" => (p >= 100 ? "success" : p >= 50 ? "warning" : "danger");

// The road from applicant to hired, in one place: what is done, what is missing, and whether HR may hire.
// Pure, so HR's card, the applicant's portal, the hire action and the tests all read the same rules.
//
//   1 Account       the applicant can sign in (self sign-up, or HR created it)
//   2 Exams         every exam this position needs is handed in
//   3 Interview     HR passed the person on to Requirements
//   4 Requirements  the required 201 file documents are in
//   5 Orientation   every company policy that needs a signature is signed
//   6 Contract      HR issued a contract and the applicant signed it
//   7 Hired         becomes an Employee or a Subcontractor (decided by the contract)
export type ContractState = "NONE" | "ISSUED" | "SIGNED";
export type Engagement = "EMPLOYEE" | "SUBCONTRACTOR";
export const ENGAGEMENT_LABEL: Record<Engagement, string> = { EMPLOYEE: "Employee", SUBCONTRACTOR: "Subcontractor" };
export const isEngagement = (v: unknown): v is Engagement => v === "EMPLOYEE" || v === "SUBCONTRACTOR";

export type PipelineInput = {
  hasAccount: boolean;
  exams: { required: number; done: number };
  stage: string; // APPLIED, SCREENING, INTERVIEW, REQUIREMENTS, OFFER, HIRED, REJECTED
  requirements: { done: number; total: number } | null; // null: no account, so nothing could be uploaded
  policies: { total: number; signed: number };
  contract: ContractState;
};

export type StepKey = "account" | "exams" | "interview" | "requirements" | "orientation" | "contract" | "hired";
export type Step = { key: StepKey; label: string; done: boolean; detail: string };

const PAST_INTERVIEW = ["REQUIREMENTS", "OFFER", "HIRED"];

export function buildPipeline(i: PipelineInput) {
  const hired = i.stage === "HIRED";
  const steps: Step[] = [
    { key: "account", label: "Applicant account", done: i.hasAccount, detail: i.hasAccount ? "Can sign in" : "No account yet. Create one so the applicant can take the exams and upload documents." },
    {
      key: "exams", label: "Exams", done: i.exams.required === 0 ? i.hasAccount : i.exams.done >= i.exams.required,
      detail: i.exams.required === 0 ? "No exam for this position" : `${Math.min(i.exams.done, i.exams.required)} of ${i.exams.required} handed in`,
    },
    { key: "interview", label: "Interview", done: PAST_INTERVIEW.includes(i.stage), detail: PAST_INTERVIEW.includes(i.stage) ? "Passed" : "Move to Requirements after the interview" },
    {
      key: "requirements", label: "Requirements (201 file)", done: !!i.requirements && i.requirements.done >= i.requirements.total,
      detail: i.requirements ? `${i.requirements.done} of ${i.requirements.total} required documents in` : "The applicant needs an account to upload",
    },
    {
      key: "orientation", label: "Orientation and policies", done: i.policies.total === 0 || i.policies.signed >= i.policies.total,
      detail: i.policies.total === 0 ? "No policy needs a signature" : `${Math.min(i.policies.signed, i.policies.total)} of ${i.policies.total} policies signed`,
    },
    {
      key: "contract", label: "Contract", done: i.contract === "SIGNED",
      detail: i.contract === "SIGNED" ? "Signed" : i.contract === "ISSUED" ? "Sent. Waiting for the applicant to sign" : "Not issued yet",
    },
    { key: "hired", label: "Hired", done: hired, detail: hired ? "Now on the team" : "Choose Employee or Subcontractor, then hire" },
  ];
  const before = steps.slice(0, 6);
  const missing = before.filter((s) => !s.done).map((s) => s.label);
  const current = hired ? "hired" : (before.find((s) => !s.done)?.key ?? "hired");
  return { steps, missing, ready: missing.length === 0, current: current as StepKey };
}

// Which contract templates suit which kind of engagement. The first one is the default.
export const TEMPLATES_FOR: Record<Engagement, ("REGULAR" | "PROBATIONARY" | "PROJECT_BASED" | "CONSULTANT")[]> = {
  EMPLOYEE: ["PROBATIONARY", "REGULAR"],
  SUBCONTRACTOR: ["CONSULTANT", "PROJECT_BASED"],
};
export const templateFits = (e: Engagement, key: string) => (TEMPLATES_FOR[e] as string[]).includes(key);

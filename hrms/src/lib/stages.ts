// Applicant stages: names, colours and the order an application moves through. One place for every screen.
export const STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "REQUIREMENTS", "OFFER", "HIRED", "REJECTED"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = { APPLIED: "Applied", SCREENING: "Screening", INTERVIEW: "Interview", REQUIREMENTS: "For requirements", OFFER: "Offer", HIRED: "Hired", REJECTED: "Rejected" };
export const STAGE_TONE = { APPLIED: "neutral", SCREENING: "brand", INTERVIEW: "brand", REQUIREMENTS: "warning", OFFER: "warning", HIRED: "success", REJECTED: "danger" } as const;

// The path an applicant walks. Hired is only reached through the Hire form.
export const STAGE_PATH: Stage[] = ["APPLIED", "SCREENING", "INTERVIEW", "REQUIREMENTS", "OFFER"];

// From these stages the applicant may upload the 201 file documents.
export const REQUIREMENT_STAGES: Stage[] = ["REQUIREMENTS", "OFFER"];
export const canUploadRequirements = (stages: string[]) => stages.some((s) => (REQUIREMENT_STAGES as string[]).includes(s));

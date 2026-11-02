// Ready-made exams for the starter positions (see STARTER_POSITIONS in ../exams.ts). Titles must match the job titles.
import type { Q } from "./software";
import { BACK_END, DEVOPS, FRONT_END, FULL_STACK } from "./software";
import { FIELD_HELPER, FIELD_LINE_MAN, FIELD_NETWORK, QUALITY_OFFICER, SAFETY_OFFICER } from "./field";
import { ADMIN_STAFF, HR_STAFF, MARKETING_STAFF, OFFICE_STAFF } from "./office";
import { PSYCH, PSYCH_POINTS } from "./psych";
import { BUSINESS_ANALYST, CLOUD_ENGINEER, IT_PM, IT_SUPPORT, NETWORK_ADMIN, SYS_ADMIN } from "./it-ops";
import { CYBERSECURITY, DATA_ANALYST, DBA, MOBILE_DEV, QA_ENGINEER, UI_UX } from "./it-dev";

export const KNOWLEDGE_BANK: Record<string, Q[]> = {
  "Software Engineer: Front End": FRONT_END,
  "Software Engineer: Back End": BACK_END,
  "Software Engineer: Full Stack": FULL_STACK,
  "Software Engineer: DevOps": DEVOPS,
  "Safety Officer": SAFETY_OFFICER,
  "Office Staff": OFFICE_STAFF,
  "Marketing Staff": MARKETING_STAFF,
  "Human Resources Staff": HR_STAFF,
  "Field Helper": FIELD_HELPER,
  "Field Network Engineer": FIELD_NETWORK,
  "Field Line Man": FIELD_LINE_MAN,
  "Quality Officer": QUALITY_OFFICER,
  "Admin Staff": ADMIN_STAFF,
  // Information technology company
  "Mobile App Developer": MOBILE_DEV,
  "QA Engineer (Software Tester)": QA_ENGINEER,
  "UI/UX Designer": UI_UX,
  "Data Analyst": DATA_ANALYST,
  "Database Administrator": DBA,
  "Cybersecurity Analyst": CYBERSECURITY,
  "IT Support Specialist": IT_SUPPORT,
  "Systems Administrator": SYS_ADMIN,
  "Cloud Engineer": CLOUD_ENGINEER,
  "Business Analyst (IT)": BUSINESS_ANALYST,
  "IT Project Manager": IT_PM,
  "Network Administrator": NETWORK_ADMIN,
};

export { ROLE_INFO, roleFields } from "./roles";

type Choice = { text: string; points: number };

// Spreads the correct answer evenly over A-D so it is not always the same letter.
export function knowledgeOptions(q: Q, index: number, salt: number): Choice[] {
  const [, right, ...wrong] = q;
  const slot = (index * 3 + salt) % 4;
  const out: Choice[] = [];
  let w = 0;
  for (let i = 0; i < 4; i++) out.push(i === slot ? { text: right, points: 1 } : { text: wrong[w++], points: 0 });
  return out;
}

// Psychological choices keep their points but are rotated so the best fit is not always first.
export function psychOptions(q: (typeof PSYCH)[number], index: number): Choice[] {
  const [, , ...texts] = q;
  const choices = texts.map((text, i) => ({ text, points: PSYCH_POINTS[i] }));
  const shift = (index * 5 + 1) % 4;
  return choices.map((_, i) => choices[(i + shift) % 4]);
}

export { PSYCH };

// Company policies to read and e-sign. Every organization starts with four plain-language texts that HR should review and
// replace with their own (or a lawyer's) wording. They are starting points, not legal advice.
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const POLICY_KIND_LABEL = {
  USER_AGREEMENT: "User agreement",
  SYSTEM_TERMS: "Terms and conditions of using the system",
  SYSTEM_PRIVACY: "Privacy policy of the system",
  COMPANY_PRIVACY: "Privacy policy of the company",
  COMPANY_POLICY: "Company policy",
} as const;
export type PolicyKindKey = keyof typeof POLICY_KIND_LABEL;

export const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

const STARTERS: { kind: PolicyKindKey; title: string; body: (org: string) => string }[] = [
  {
    kind: "USER_AGREEMENT",
    title: "User Agreement",
    body: (org) => `This agreement is between you and ${org} ("the Company") for your account in the Company's HR system.

1. Your account is personal. Do not share your username, password or time-clock access. Every action made with your account is recorded as yours.
2. Record your time truthfully. Time stamps record the time on the server and the location of your device. Stamping for someone else, or asking someone to stamp for you, is a serious offense under the Company's code of conduct.
3. Keep your information current: contact details, 201 file documents and government numbers.
4. Use the chat, voice and video calls for work. Messages may be reviewed by the Company when an incident or complaint requires it.
5. The Company may suspend your access when you leave the Company or break this agreement.

By signing, you confirm that you have read and understood this agreement.`,
  },
  {
    kind: "SYSTEM_TERMS",
    title: "Terms and Conditions of Using the System",
    body: (org) => `1. The system is provided by ${org} for managing employment records, time and attendance, leave, payroll and communication.
2. Access is given according to your role. Do not try to open records you are not allowed to see.
3. Do not upload files that are not yours to share, that contain malware, or that are not related to your employment.
4. Records you send (time stamps, daily reports, signatures) are kept as sent. Corrections are made by a new entry, not by changing the old one.
5. The Company keeps an audit log of important actions: who did what, and when.
6. The Company may change these terms. You will be asked to sign the new version.`,
  },
  {
    kind: "SYSTEM_PRIVACY",
    title: "Privacy Policy of the System",
    body: (org) => `This explains what the HR system collects about you and why, in line with the Data Privacy Act of 2012 (Republic Act No. 10173).

What is collected: your name, contact details, employment details, 201 file documents, government numbers, pay, schedules, time stamps with the location, device and network address at the moment you stamp, leave and overtime requests, daily reports, chat messages, and your signatures on policies.

Why: to manage your employment, pay you correctly, meet legal obligations (BIR, SSS, PhilHealth, Pag-IBIG, DOLE), and keep records auditable.

Location: taken only when you press a time stamp button, or when you choose to confirm a stamp with your phone. Nothing is tracked in the background.

Who can see it: you; your supervisors for the people below them; HR for everyone in ${org}. Pay details are visible to HR only.

Your rights: to be informed, to access, to correct, to object, and to file a complaint with the National Privacy Commission. Contact HR for any request.`,
  },
  {
    kind: "COMPANY_PRIVACY",
    title: "Privacy Policy of the Company",
    body: (org) => `${org} processes the personal information of its employees for employment, payroll, benefits, security and legal compliance.

The Company collects only what it needs, keeps it safe, limits access to the people who need it for their work, and keeps it only as long as the law or a legitimate purpose requires.

The Company's Data Protection Officer can be reached through HR. You may request access to or correction of your personal information at any time.`,
  },
];

// Installs the starter texts the first time an organization opens Policies. Each is version 1 and needs a signature.
export async function ensurePolicies(organizationId: string, orgName: string) {
  if (await prisma.policyDocument.count({ where: { organizationId } })) return;
  await prisma.policyDocument.createMany({
    data: STARTERS.map((p) => {
      const body = p.body(orgName);
      return { organizationId, kind: p.kind, title: p.title, body, contentHash: sha256(body) };
    }),
  });
}

// Required policies this employee has not signed yet (current versions only).
export async function unsignedPolicies(organizationId: string, employeeId: string) {
  return prisma.policyDocument.findMany({
    where: { organizationId, archivedAt: null, requiresSignature: true, signatures: { none: { employeeId } } },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });
}

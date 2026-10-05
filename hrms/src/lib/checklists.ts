import type { Prisma } from "@/generated/prisma/client";

type Db = Prisma.TransactionClient;
type Kind = "ONBOARDING" | "OFFBOARDING";
type Owner = "HR" | "MANAGER" | "EMPLOYEE";

// Starting checklists. The Super Admin edits them in Settings; nothing is fixed.
export const DEFAULT_CHECKLISTS: { kind: Kind; title: string; owner: Owner }[] = [
  { kind: "ONBOARDING", owner: "HR", title: "Collect the signed contract" },
  { kind: "ONBOARDING", owner: "HR", title: "Collect IDs and government requirements" },
  { kind: "ONBOARDING", owner: "EMPLOYEE", title: "Complete your personal information" },
  { kind: "ONBOARDING", owner: "EMPLOYEE", title: "Read the employee handbook" },
  { kind: "ONBOARDING", owner: "MANAGER", title: "Prepare the work station and tools" },
  { kind: "ONBOARDING", owner: "MANAGER", title: "Introduce the new hire to the team" },
  { kind: "ONBOARDING", owner: "MANAGER", title: "Agree on first-month goals" },
  { kind: "OFFBOARDING", owner: "EMPLOYEE", title: "Return company equipment" },
  { kind: "OFFBOARDING", owner: "EMPLOYEE", title: "Hand over current work" },
  { kind: "OFFBOARDING", owner: "MANAGER", title: "Confirm the handover" },
  { kind: "OFFBOARDING", owner: "MANAGER", title: "Hold the exit interview" },
  { kind: "OFFBOARDING", owner: "HR", title: "Sign the clearance" },
  { kind: "OFFBOARDING", owner: "HR", title: "Compute final pay" },
  { kind: "OFFBOARDING", owner: "HR", title: "Issue the certificate of employment" },
];

export const OWNER_LABEL = { HR: "HR", MANAGER: "Manager", EMPLOYEE: "Employee" } as const;

// Templates for an organization, created from the defaults the first time they are needed.
export async function ensureTemplates(db: Db, organizationId: string) {
  if ((await db.checklistTemplate.count({ where: { organizationId } })) === 0) {
    await db.checklistTemplate.createMany({ data: DEFAULT_CHECKLISTS.map((t, i) => ({ ...t, organizationId, sortOrder: i * 10 })) });
  }
}

// Copies the active templates onto one employee. Does nothing if that checklist already exists, so it can be called twice safely.
export async function createChecklist(db: Db, organizationId: string, employeeId: string, kind: Kind) {
  if ((await db.checklistItem.count({ where: { employeeId, organizationId, kind } })) > 0) return 0;
  await ensureTemplates(db, organizationId);
  const templates = await db.checklistTemplate.findMany({ where: { organizationId, kind, archivedAt: null }, orderBy: { sortOrder: "asc" } });
  if (!templates.length) return 0;
  await db.checklistItem.createMany({ data: templates.map((t, i) => ({ organizationId, employeeId, kind, title: t.title, owner: t.owner, sortOrder: i })) });
  return templates.length;
}

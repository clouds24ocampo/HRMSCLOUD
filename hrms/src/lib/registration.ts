import { prisma } from "@/lib/prisma";

// One company per install: registration closes as soon as an organization exists. Tests that need several companies
// set ALLOW_MULTIPLE_ORGS=true in the server environment; production never does.
export const MULTI_ORG = process.env.ALLOW_MULTIPLE_ORGS === "true";

export async function registrationOpen(): Promise<boolean> {
  return MULTI_ORG || (await prisma.organization.count()) === 0;
}

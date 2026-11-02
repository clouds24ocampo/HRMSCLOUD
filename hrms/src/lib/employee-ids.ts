// Saves an employee's government numbers (SSS, PhilHealth, TIN, Pag-IBIG). One place, used by the employee's own profile page
// and by HR on the ID page. The numbers live on the employee and are mirrored to the latest tax profile, which feeds the
// SSS, PhilHealth, Pag-IBIG and BIR reports. Nothing else in the tax profile is touched, so payroll is not affected.
import { prisma } from "@/lib/prisma";
import { GOV_KINDS, parseGovId, type GovKind } from "@/lib/gov-ids";

export type GovNumbers = Partial<Record<GovKind, string | null>>;

// Reads the four fields of a form. Returns the formatted numbers, or the first error.
export function readGovNumbers(form: FormData): { ok: true; nums: GovNumbers } | { ok: false; error: string } {
  const nums: GovNumbers = {};
  for (const k of GOV_KINDS) {
    const r = parseGovId(k, String(form.get(k) ?? ""));
    if (!r.ok) return r;
    nums[k] = r.value;
  }
  return { ok: true, nums };
}

export async function saveGovNumbers(organizationId: string, employeeId: string, nums: GovNumbers, extra: { idIssuedOn?: Date | null } = {}) {
  await prisma.employee.update({
    where: { id: employeeId },
    data: { sssNo: nums.sss, philhealthNo: nums.philhealth, tinNo: nums.tin, pagibigNo: nums.pagibig, ...(extra.idIssuedOn !== undefined ? { idIssuedOn: extra.idIssuedOn } : {}) },
  });
  const latest = await prisma.employeeTaxProfile.findFirst({ where: { employeeId, organizationId }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }], select: { id: true } });
  if (latest) await prisma.employeeTaxProfile.update({ where: { id: latest.id }, data: { sssNo: nums.sss, philhealthNo: nums.philhealth, tin: nums.tin, pagibigNo: nums.pagibig } });
  return GOV_KINDS.filter((k) => nums[k]); // which numbers are set, for the audit trail (never the numbers)
}

// Builds the digital ID for one employee from the HR design plus their own record.
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requestEvidence } from "@/lib/device";
import { formatDay, keyOfDbDate } from "@/lib/time";
import { initialsOf } from "@/lib/id-card-style";
import { GOV_LABEL, maskGovId } from "@/lib/gov-ids";
import type { IdCardData } from "@/app/(app)/id/IdCard";

export const DEFAULT_TERMS = [
  "Identification: Carry the ID card at all times during working hours for identification purposes.",
  "Authorized Use: The ID card is strictly for official use and should not be shared or used for unauthorized purposes.",
];

export const idDesign = (organizationId: string) => prisma.idCardSettings.findUnique({ where: { organizationId } });

const longDay = (d: Date) => formatDay(keyOfDbDate(d), { month: "long", day: "numeric", year: "numeric" });
// Same month and day, some years later.
export const addYears = (d: Date, years: number) => new Date(Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate()));

// `revealNumbers`: the owner and HR see the government numbers in full. Everyone else who may open the card sees them masked.
export async function idCardFor(organizationId: string, employeeId: string, opts: { revealNumbers?: boolean } = {}): Promise<IdCardData | null> {
  const [e, s, org] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
      select: {
        id: true, firstName: true, lastName: true, employeeNo: true, hireDate: true, photoKey: true, phone: true, email: true, address: true,
        sssNo: true, philhealthNo: true, tinNo: true, pagibigNo: true, idIssuedOn: true, birthDate: true,
        position: { select: { title: true } }, department: { select: { name: true } }, user: { select: { role: { select: { name: true } } } },
      },
    }),
    idDesign(organizationId),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
  ]);
  if (!e || !org) return null;
  // Scanning the code opens the profile. Only someone allowed to see this person (HR, their supervisors) gets past sign-in.
  const url = `${(await requestEvidence()).origin}/employees/${e.id}?via=id`;
  const show = (v: string | null) => (opts.revealNumbers ? v : maskGovId(v));
  const terms = (s?.terms ?? "").split("\n").map((t) => t.trim()).filter(Boolean);
  return {
    org: org.name, orgInitials: initialsOf(org.name), title: s?.title ?? "EMPLOYEE ID", footer: s?.footer ?? null, address: s?.address ?? null,
    logoUrl: s?.logoKey ? `/id/logo?v=${s.logoKey.slice(-8)}` : null,
    name: `${e.firstName} ${e.lastName}`, displayName: `${e.lastName}, ${e.firstName}`,
    employeeNo: s?.showEmployeeNo === false ? null : e.employeeNo,
    position: s?.showPosition === false ? null : e.position?.title ?? null,
    // The category is the person's kind of account: Employee, Sub Contractor, Manager, HR Admin, Super Admin.
    category: e.user?.role.name ?? "Employee",
    department: s?.showDepartment === false ? null : e.department?.name ?? null,
    hireDate: s?.showHireDate === false ? null : longDay(e.hireDate),
    photoUrl: e.photoKey ? `/employees/${e.id}/photo?v=${e.photoKey.slice(-8)}` : null,
    contact: { address: e.address, phone: e.phone, email: e.email },
    birthDate: e.birthDate ? longDay(e.birthDate) : null,
    gov: [
      { label: GOV_LABEL.sss, value: show(e.sssNo) }, { label: GOV_LABEL.philhealth, value: show(e.philhealthNo) },
      { label: GOV_LABEL.tin, value: show(e.tinNo) }, { label: GOV_LABEL.pagibig, value: show(e.pagibigNo) },
    ],
    govMasked: !opts.revealNumbers,
    terms: terms.length ? terms : DEFAULT_TERMS,
    issuedOn: e.idIssuedOn ? longDay(e.idIssuedOn) : null,
    expiresOn: e.idIssuedOn ? longDay(addYears(e.idIssuedOn, s?.validYears ?? 2)) : null,
    signatory: { name: s?.signatoryName ?? null, title: s?.signatoryTitle ?? null, signatureUrl: s?.signatureKey ? `/id/signature?v=${s.signatureKey.slice(-8)}` : null },
    qr: await QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" }),
  };
}

// Builds the digital ID for one employee from the HR design plus their own record.
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requestEvidence } from "@/lib/device";
import { formatDay, keyOfDbDate } from "@/lib/time";
import type { IdCardData } from "@/app/(app)/id/IdCard";

export const idDesign = (organizationId: string) => prisma.idCardSettings.findUnique({ where: { organizationId } });

export async function idCardFor(organizationId: string, employeeId: string): Promise<IdCardData | null> {
  const [e, s, org] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
      select: { id: true, firstName: true, lastName: true, employeeNo: true, hireDate: true, photoKey: true, position: { select: { title: true } }, department: { select: { name: true } } },
    }),
    idDesign(organizationId),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
  ]);
  if (!e || !org) return null;
  // Scanning the code opens the profile. Only someone allowed to see this person (HR, their supervisors) gets past sign-in.
  const url = `${(await requestEvidence()).origin}/employees/${e.id}?via=id`;
  return {
    org: org.name, title: s?.title ?? "EMPLOYEE ID", accent: s?.accent ?? "#2563eb", footer: s?.footer ?? null,
    name: `${e.firstName} ${e.lastName}`,
    employeeNo: s?.showEmployeeNo === false ? null : e.employeeNo,
    position: s?.showPosition === false ? null : e.position?.title ?? null,
    department: s?.showDepartment === false ? null : e.department?.name ?? null,
    hireDate: s?.showHireDate === false ? null : formatDay(keyOfDbDate(e.hireDate), { month: "long", day: "numeric", year: "numeric" }),
    photoUrl: e.photoKey ? `/employees/${e.id}/photo?v=${e.photoKey.slice(-8)}` : null,
    signatory: { name: s?.signatoryName ?? null, title: s?.signatoryTitle ?? null, signatureUrl: s?.signatureKey ? `/id/signature?v=${s.signatureKey.slice(-8)}` : null },
    qr: await QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" }),
  };
}

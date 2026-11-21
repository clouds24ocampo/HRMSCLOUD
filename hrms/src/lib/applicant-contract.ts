// The contract an applicant signs before being hired. HR issues it from the applicant's card (employee or subcontractor);
// the applicant reads and signs it in the portal; at hire a signed copy goes into the new employee's own Contracts.
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { formatDay, keyOfDbDate } from "@/lib/time";
import { CONTRACT_TEMPLATES, interpolateContract, type ContractTemplateKey } from "@/lib/contract-templates";
import { ENGAGEMENT_LABEL, templateFits, type Engagement } from "@/lib/hiring-pipeline";

export async function issueApplicantContract(p: {
  organizationId: string; applicantId: string; engagement: Engagement; templateKey: ContractTemplateKey;
  startDate: Date; address?: string; pay?: string; customBody?: string; issuedById: string;
}) {
  if (!templateFits(p.engagement, p.templateKey)) throw new Error(`That template is not for a${p.engagement === "EMPLOYEE" ? "n" : ""} ${ENGAGEMENT_LABEL[p.engagement].toLowerCase()}. Choose one from the list.`);
  const a = await prisma.applicant.findFirst({
    where: { id: p.applicantId, organizationId: p.organizationId },
    include: { job: { select: { title: true, department: { select: { name: true } }, position: { select: { title: true } } } }, profile: { select: { userId: true, applicantNo: true } }, offerContracts: { where: { status: { not: "VOID" } }, select: { id: true, status: true } } },
  });
  if (!a) throw new Error("Applicant not found.");
  if (!["REQUIREMENTS", "OFFER"].includes(a.stage)) throw new Error("A contract can be issued once the applicant has passed the interview (stage Requirements or Orientation and contract).");
  if (!a.profile) throw new Error("Create the applicant's account first. They need it to read and sign the contract.");
  if (a.offerContracts.length) throw new Error("This applicant already has a contract. Cancel it first to issue a new one.");

  const org = await prisma.organization.findUnique({ where: { id: p.organizationId }, select: { name: true } });
  const tpl = CONTRACT_TEMPLATES[p.templateKey];
  const body = p.customBody?.trim() || interpolateContract(tpl.template, {
    name: a.name,
    address: p.address?.trim() || "Address on File",
    position: a.job.position?.title || a.job.title,
    department: a.job.department?.name || "General",
    salary: p.pay?.trim() || "Competitive compensation",
    startDate: formatDay(keyOfDbDate(p.startDate), { month: "long", day: "numeric", year: "numeric" }),
    employeeNo: a.profile.applicantNo,
    companyName: org?.name || "The Company",
  });
  const c = await prisma.applicantContract.create({
    data: { organizationId: p.organizationId, applicantId: a.id, engagement: p.engagement, templateKey: p.templateKey, title: `${tpl.name} - ${a.name}`, body, startDate: p.startDate, status: "ISSUED", issuedAt: new Date(), issuedById: p.issuedById },
  });
  await audit(p.issuedById, "applicant.contract_issued", "Applicant", a.id, { contractId: c.id, engagement: p.engagement, template: p.templateKey }, p.organizationId);
  await notify(p.organizationId, [a.profile.userId], { title: "Your contract is ready. Please read it and sign.", href: "/apply" }, p.issuedById);
  return c;
}

export async function voidApplicantContract(p: { organizationId: string; contractId: string; reason: string; byId: string }) {
  const c = await prisma.applicantContract.findFirst({ where: { id: p.contractId, organizationId: p.organizationId }, include: { applicant: { select: { id: true, stage: true } } } });
  if (!c) throw new Error("Contract not found.");
  if (c.status === "VOID") throw new Error("This contract is already cancelled.");
  if (c.applicant.stage === "HIRED") throw new Error("This applicant is already hired. Cancel the contract from the employee's Contracts instead.");
  await prisma.applicantContract.update({ where: { id: c.id }, data: { status: "VOID", voidReason: p.reason.trim(), voidedAt: new Date() } });
  await audit(p.byId, "applicant.contract_voided", "Applicant", c.applicantId, { contractId: c.id, wasSigned: c.status === "SIGNED", reason: p.reason.trim() }, p.organizationId);
}

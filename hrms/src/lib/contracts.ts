import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { formatDay, keyOfDbDate } from "@/lib/time";
import { formatMoney } from "@/lib/money";

export * from "./contract-templates";
import { CONTRACT_TEMPLATES, interpolateContract, type ContractTemplateKey, type EmployeeContractData } from "./contract-templates";

/**
 * Fetch employee details prefilled for contract generation
 */
export async function getEmployeeContractContext(employeeId: string, organizationId: string) {
  const [employee, org, comp] = await Promise.all([
    // Inside the organization only: an employee id from another company is "not found".
    prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
      include: {
        position: true,
        department: true,
        user: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.compensation.findFirst({
      where: { employeeId, organizationId, effectiveFrom: { lte: new Date() } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (!employee) throw new Error("Employee not found.");

  const fullName = `${employee.firstName} ${employee.lastName}`;
  const address = employee.address?.trim() || "Address on File";
  const position = employee.position?.title || "Employee";
  const department = employee.department?.name || "General";
  const companyName = org?.name || "The Company";
  const startDate = formatDay(keyOfDbDate(employee.hireDate), { month: "long", day: "numeric", year: "numeric" });
  const salary = comp ? `${formatMoney(comp.rateCents)} (${comp.payType.toLowerCase()})` : "Competitive compensation";

  const contextData: EmployeeContractData = {
    name: fullName,
    address,
    position,
    department,
    salary,
    startDate,
    employeeNo: employee.employeeNo,
    companyName,
  };

  return { employee, org, comp, contextData };
}

/**
 * Generate and create a new contract
 */
export async function createContract(params: {
  organizationId: string;
  employeeId: string;
  templateKey: ContractTemplateKey;
  customBody?: string;
  createdById: string;
  autoIssue?: boolean;
}) {
  const { organizationId, employeeId, templateKey, customBody, createdById, autoIssue } = params;
  const { contextData, employee } = await getEmployeeContractContext(employeeId, organizationId);

  const rawTemplate = CONTRACT_TEMPLATES[templateKey]?.template ?? CONTRACT_TEMPLATES.REGULAR.template;
  const body = customBody?.trim() || interpolateContract(rawTemplate, contextData);
  const title = `${CONTRACT_TEMPLATES[templateKey]?.name || "Employment Contract"} - ${contextData.name}`;

  const contract = await prisma.contract.create({
    data: {
      organizationId,
      employeeId,
      templateKey,
      title,
      body,
      status: autoIssue ? "ISSUED" : "DRAFT",
      issuedAt: autoIssue ? new Date() : null,
      issuedById: autoIssue ? createdById : null,
      createdById,
    },
  });

  await audit(
    createdById,
    "contract.created",
    "Contract",
    contract.id,
    {
      employeeId,
      templateKey,
      title,
      status: contract.status,
    },
    organizationId,
  );

  if (autoIssue && employee.userId) {
    await notify(
      organizationId,
      [employee.userId],
      {
        title: "📝 Employment Contract Issued",
        body: `Your ${CONTRACT_TEMPLATES[templateKey]?.name || "Employment Contract"} is ready for review and signature.`,
        href: `/contracts/${contract.id}`,
      },
      createdById,
    );
  }

  return contract;
}

/**
 * Employee signs the contract
 */
export async function signContract(contractId: string, employeeUserId: string, note?: string | null, ip?: string | null) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { employee: true },
  });

  if (!contract) throw new Error("Contract not found.");
  if (contract.employee.userId !== employeeUserId) {
    throw new Error("You are not authorized to sign this contract.");
  }
  if (contract.status === "SIGNED") {
    throw new Error("This contract has already been signed.");
  }
  if (contract.status === "VOID") {
    throw new Error("This contract has been cancelled.");
  }
  // Only a contract HR has issued can be signed: a draft is not open to the employee yet.
  if (contract.status !== "ISSUED") {
    throw new Error("This contract is not available for signing.");
  }

  const updated = await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: "SIGNED",
      signedAt: new Date(),
      signatureIp: ip || null,
      signatureNote: note?.trim() || "Signed electronically on HRMS",
    },
  });

  await audit(
    employeeUserId,
    "contract.signed",
    "Contract",
    contractId,
    {
      employeeId: contract.employeeId,
      signedAt: updated.signedAt,
      ip,
    },
    contract.organizationId,
  );

  if (contract.issuedById) {
    await notify(
      contract.organizationId,
      [contract.issuedById],
      {
        title: `Contract Signed by ${contract.employee.firstName} ${contract.employee.lastName}`,
        body: `${contract.title} has been electronically signed.`,
        href: `/contracts/${contract.id}`,
      },
      employeeUserId,
    );
  }

  return updated;
}

/** Status a voided contract returns to, derived from its own timestamps so no extra column is needed. */
export function restoredStatus(c: { signedAt: Date | null; issuedAt: Date | null }): "SIGNED" | "ISSUED" | "DRAFT" {
  return c.signedAt ? "SIGNED" : c.issuedAt ? "ISSUED" : "DRAFT";
}

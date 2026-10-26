// Shared display labels. Pages cannot export these themselves (Next.js only allows the page component).
export const STATUS_TONE = { ACTIVE: "success", ON_LEAVE: "warning", SUSPENDED: "danger", SEPARATED: "neutral" } as const;
export const STATUS_LABEL = { ACTIVE: "Active", ON_LEAVE: "On leave", SUSPENDED: "Suspended", SEPARATED: "Separated" } as const;

export const PAYROLL_STATUS = {
  DRAFT: { label: "Draft", tone: "neutral" },
  CALCULATED: { label: "Calculated", tone: "warning" },
  APPROVED: { label: "Approved", tone: "brand" },
  FINALIZED: { label: "Finalized", tone: "success" },
} as const;

export const REQUEST_CATEGORIES = ["Employment certificate", "Salary certificate", "Update my information", "Leave concern", "Payroll concern", "Benefits concern", "Equipment request", "Complaint", "Other"] as const;

export const TAX_CLASS_LABEL = { TAXABLE: "", EXEMPT: " · not taxable", DE_MINIMIS: " · de minimis (exempt up to its limit)", OTHER_BENEFIT: " · shares the yearly ₱90,000 exemption" } as const;
export const HOLIDAY_LABEL = { REGULAR: "Regular holiday", SPECIAL_NON_WORKING: "Special non-working day", SPECIAL_WORKING: "Special working day" } as const;
export const PAYROLL_KIND_LABEL = { REGULAR: "Regular payroll", THIRTEENTH_MONTH: "13th month pay", GOV_INCENTIVE: "Government bonus or incentive" } as const;

// "VOID" is the stored status; people see it as Cancelled.
export const CONTRACT_STATUS_BADGE = {
  DRAFT: { label: "Draft", tone: "neutral" },
  ISSUED: { label: "Issued (Awaiting Signature)", tone: "warning" },
  SIGNED: { label: "Signed ✓", tone: "success" },
  VOID: { label: "Cancelled", tone: "danger" },
} as const;

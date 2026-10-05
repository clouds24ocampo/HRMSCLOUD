// Statutory leave types to add on request. Days are the usual entitlement; they are ordinary leave types afterwards, so HR can edit them.
// Leave accrual (for example 1.25 days a month under Civil Service rules) is not modeled: the yearly total is granted at once.
export type LeavePreset = { name: string; annualDays: number; paid: boolean; sector: "PRIVATE" | "GOVERNMENT" | "BOTH"; basis: string };

export const LEAVE_PRESETS: LeavePreset[] = [
  { name: "Service incentive leave", annualDays: 5, paid: true, sector: "PRIVATE", basis: "Labor Code art. 95: 5 days a year after one year of service, for covered employees." },
  { name: "Maternity leave", annualDays: 105, paid: true, sector: "BOTH", basis: "RA 11210: 105 days for live childbirth (120 for a solo parent, 60 for miscarriage). Private employees receive SSS maternity benefit plus the employer salary differential." },
  { name: "Paternity leave", annualDays: 7, paid: true, sector: "BOTH", basis: "RA 8187: 7 days for a married male employee." },
  { name: "Solo parent leave", annualDays: 7, paid: true, sector: "BOTH", basis: "RA 8972 as amended by RA 11861: 7 working days for a qualified solo parent." },
  { name: "VAWC leave", annualDays: 10, paid: true, sector: "BOTH", basis: "RA 9262: up to 10 days for a woman employee who is a victim of violence." },
  { name: "Special leave for women", annualDays: 60, paid: true, sector: "BOTH", basis: "RA 9710: up to 2 months for surgery due to a gynecological disorder." },
  { name: "Vacation leave (Civil Service)", annualDays: 15, paid: true, sector: "GOVERNMENT", basis: "CSC leave rules: 15 days a year (1.25 days a month). 5 days are mandatory (forced) leave." },
  { name: "Sick leave (Civil Service)", annualDays: 15, paid: true, sector: "GOVERNMENT", basis: "CSC leave rules: 15 days a year (1.25 days a month)." },
  { name: "Special privilege leave", annualDays: 3, paid: true, sector: "GOVERNMENT", basis: "CSC leave rules: 3 days a year." },
  { name: "Adoption leave", annualDays: 60, paid: true, sector: "GOVERNMENT", basis: "CSC rules: 60 days for qualified adoptive parents." },
  { name: "Wellness leave", annualDays: 5, paid: true, sector: "GOVERNMENT", basis: "CSC MC 01, s. 2026: up to 5 days, at the agency's discretion." },
  { name: "Special emergency (calamity) leave", annualDays: 5, paid: true, sector: "GOVERNMENT", basis: "CSC rules: up to 5 days for employees affected by a calamity." },
];

export const leavePresetsFor = (scope: "PRIVATE" | "GOVERNMENT" | "BOTH") => LEAVE_PRESETS.filter((l) => scope === "BOTH" || l.sector === "BOTH" || l.sector === scope);

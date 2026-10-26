import type { IconName } from "@/components/Icon";

export type NavItem = { href: string; label: string; icon: IconName };
export type NavGroup = { title?: string; items: NavItem[] };

// Every item still passes canAccess() per role before it is shown. Hiding is cosmetic; pages enforce access themselves.
export const MENU: NavGroup[] = [
  { items: [{ href: "/dashboard", label: "Home", icon: "home" }] },
  {
    title: "People",
    items: [
      { href: "/employees", label: "Employees", icon: "employee" },
      { href: "/contracts", label: "Contracts", icon: "contract" },
      { href: "/handbook", label: "Company Handbook", icon: "handbook" },
      { href: "/organization", label: "Organization", icon: "organization" },
      { href: "/recruitment", label: "Recruitment", icon: "recruitment" },
      { href: "/documents", label: "Documents", icon: "documents" },
      { href: "/policies", label: "Policies", icon: "policies" },
      { href: "/id", label: "Digital ID", icon: "id" },
    ],
  },
  {
    title: "Time",
    items: [
      { href: "/schedule", label: "Schedule", icon: "schedule" },
      { href: "/dtr", label: "DTR", icon: "dtr" },
      { href: "/overtime", label: "Overtime", icon: "overtime" },
      { href: "/leave", label: "Leave", icon: "leave" },
      { href: "/daily-report", label: "Daily report", icon: "dailyReport" },
    ],
  },
  {
    title: "Work",
    items: [{ href: "/worksync", label: "WorkSync", icon: "worksync" }],
  },
  {
    title: "Pay",
    items: [
      { href: "/payroll", label: "Payroll", icon: "payroll" },
      { href: "/payslips", label: "My payslips", icon: "payslip" },
      { href: "/cash-advance", label: "Cash advance", icon: "cashAdvance" },
      { href: "/incentives", label: "Incentives", icon: "incentive" },
    ],
  },
  {
    title: "Talent",
    items: [
      { href: "/performance", label: "Performance", icon: "performance" },
      { href: "/learning", label: "Learning", icon: "learning" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/chat", label: "Chat", icon: "chat" },
      { href: "/requests", label: "HR requests", icon: "requests" },
      { href: "/announcements", label: "Announcements", icon: "announcement" },
      { href: "/reports", label: "Reports", icon: "reports" },
      { href: "/analytics", label: "Activity analytics", icon: "analytics" },
    ],
  },
  {
    title: "Manage",
    items: [
      { href: "/settings", label: "Settings", icon: "settings" },
      { href: "/admin/users", label: "Users", icon: "users" },
      { href: "/audit", label: "Audit log", icon: "audit" },
    ],
  },
];

// The four shortcuts shown in the phone's bottom bar. Everything else sits behind "More".
export const MOBILE_PRIMARY = ["/dashboard", "/dtr", "/schedule", "/leave"];

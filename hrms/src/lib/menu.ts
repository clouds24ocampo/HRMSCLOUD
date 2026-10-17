export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { title?: string; items: NavItem[] };

// Every item still passes canAccess() per role before it is shown. Hiding is cosmetic; pages enforce access themselves.
export const MENU: NavGroup[] = [
  { items: [{ href: "/dashboard", label: "Home", icon: "🏠" }] },
  {
    title: "People",
    items: [
      { href: "/employees", label: "Employees", icon: "👤" },
      { href: "/organization", label: "Organization", icon: "🏢" },
      { href: "/recruitment", label: "Recruitment", icon: "🎯" },
      { href: "/documents", label: "Documents", icon: "🗂️" },
      { href: "/policies", label: "Policies", icon: "📜" },
      { href: "/id", label: "Digital ID", icon: "🪪" },
    ],
  },
  {
    title: "Time",
    items: [
      { href: "/schedule", label: "Schedule", icon: "📅" },
      { href: "/dtr", label: "DTR", icon: "⏱️" },
      { href: "/overtime", label: "Overtime", icon: "⏰" },
      { href: "/leave", label: "Leave", icon: "🏖️" },
      { href: "/daily-report", label: "Daily report", icon: "🗒️" },
    ],
  },
  {
    title: "Pay",
    items: [
      { href: "/payroll", label: "Payroll", icon: "💰" },
      { href: "/payslips", label: "My payslips", icon: "🧾" },
      { href: "/cash-advance", label: "Cash advance", icon: "💵" },
    ],
  },
  {
    title: "Talent",
    items: [
      { href: "/performance", label: "Performance", icon: "📈" },
      { href: "/learning", label: "Learning", icon: "🎓" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/chat", label: "Chat", icon: "💬" },
      { href: "/requests", label: "HR requests", icon: "🛎️" },
      { href: "/announcements", label: "Announcements", icon: "📣" },
      { href: "/reports", label: "Reports", icon: "📊" },
      { href: "/analytics", label: "Activity analytics", icon: "🧭" },
    ],
  },
  {
    title: "Manage",
    items: [
      { href: "/settings", label: "Settings", icon: "⚙️" },
      { href: "/admin/users", label: "Users", icon: "🔑" },
      { href: "/audit", label: "Audit log", icon: "📝" },
    ],
  },
];

// The four shortcuts shown in the phone's bottom bar. Everything else sits behind "More".
export const MOBILE_PRIMARY = ["/dashboard", "/dtr", "/schedule", "/leave"];

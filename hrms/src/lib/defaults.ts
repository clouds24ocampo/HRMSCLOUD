// Starting points chosen from the industry picked at registration. Everything here is editable data afterwards.
// The time-stamp engine is identical for all organizations; only these values differ.

export const DEFAULT_LEAVE_TYPES = [
  { name: "Vacation leave", annualDays: 15, paid: true },
  { name: "Sick leave", annualDays: 10, paid: true },
  { name: "Emergency leave", annualDays: 3, paid: true },
];

type Shift = { name: string; startTime: string; endTime: string; breakMinutes: number };
const REGULAR: Shift = { name: "Regular (8 to 5)", startTime: "08:00", endTime: "17:00", breakMinutes: 60 };
const ROTATING: Shift[] = [
  { name: "Morning (6 to 2)", startTime: "06:00", endTime: "14:00", breakMinutes: 30 },
  { name: "Afternoon (2 to 10)", startTime: "14:00", endTime: "22:00", breakMinutes: 30 },
  { name: "Night (10 to 6)", startTime: "22:00", endTime: "06:00", breakMinutes: 30 },
];

const SHIFT_PRESETS: Record<string, Shift[]> = {
  "bpo-it": [REGULAR, { name: "Mid (2 to 11)", startTime: "14:00", endTime: "23:00", breakMinutes: 60 }, { name: "Night (10 to 7)", startTime: "22:00", endTime: "07:00", breakMinutes: 60 }],
  healthcare: ROTATING,
  "logistics-security": ROTATING,
  "retail-hospitality": [{ name: "Opening (9 to 6)", startTime: "09:00", endTime: "18:00", breakMinutes: 60 }, { name: "Closing (1 to 10)", startTime: "13:00", endTime: "22:00", breakMinutes: 60 }],
  manufacturing: ROTATING,
};
export const shiftPresetFor = (categoryKey: string): Shift[] => SHIFT_PRESETS[categoryKey] ?? [REGULAR];

// One-click suggestions on the Organization page. The Super Admin picks what applies.
export const DEPARTMENT_SUGGESTIONS: Record<string, string[]> = {
  government: ["Office of the Mayor", "Human Resource Management", "Treasury", "Engineering", "Health Office", "Social Welfare"],
  "bpo-it": ["Operations", "Human Resources", "Quality Assurance", "IT Support", "Training", "Finance"],
  "retail-hospitality": ["Store Operations", "Kitchen", "Warehouse", "Human Resources", "Finance", "Marketing"],
  manufacturing: ["Production", "Quality Control", "Maintenance", "Warehouse", "Safety", "Human Resources"],
  healthcare: ["Nursing", "Emergency", "Laboratory", "Pharmacy", "Administration", "Human Resources"],
  education: ["Academics", "Registrar", "Student Affairs", "Finance", "Human Resources", "Facilities"],
  "finance-professional": ["Client Services", "Operations", "Compliance", "Finance", "Human Resources", "Sales"],
  "logistics-security": ["Operations", "Dispatch", "Fleet", "Human Resources", "Finance", "Client Accounts"],
  nonprofit: ["Programs", "Fundraising", "Finance", "Human Resources", "Communications"],
  "small-business": ["Operations", "Sales", "Finance", "Administration"],
};

export const POSITION_SUGGESTIONS: Record<string, { title: string; level: "ENTRY" | "TEAM_LEAD" | "MANAGER" | "DEPT_HEAD" | "EXECUTIVE" }[]> = {
  government: [
    { title: "Administrative Aide", level: "ENTRY" }, { title: "Administrative Officer", level: "TEAM_LEAD" },
    { title: "Section Chief", level: "MANAGER" }, { title: "Department Head", level: "DEPT_HEAD" }, { title: "Municipal Administrator", level: "EXECUTIVE" },
  ],
  "bpo-it": [
    { title: "Agent", level: "ENTRY" }, { title: "Team Leader", level: "TEAM_LEAD" },
    { title: "Operations Manager", level: "MANAGER" }, { title: "Department Head", level: "DEPT_HEAD" }, { title: "Director", level: "EXECUTIVE" },
  ],
  healthcare: [
    { title: "Staff Nurse", level: "ENTRY" }, { title: "Charge Nurse", level: "TEAM_LEAD" },
    { title: "Nurse Manager", level: "MANAGER" }, { title: "Department Head", level: "DEPT_HEAD" }, { title: "Chief Operating Officer", level: "EXECUTIVE" },
  ],
};
const GENERIC_POSITIONS = [
  { title: "Staff", level: "ENTRY" as const }, { title: "Team Leader", level: "TEAM_LEAD" as const },
  { title: "Manager", level: "MANAGER" as const }, { title: "Department Head", level: "DEPT_HEAD" as const }, { title: "Executive", level: "EXECUTIVE" as const },
];
export const positionSuggestionsFor = (categoryKey: string) => POSITION_SUGGESTIONS[categoryKey] ?? GENERIC_POSITIONS;

export const LEVEL_LABEL = { ENTRY: "Entry level", TEAM_LEAD: "Team leader", MANAGER: "Manager", DEPT_HEAD: "Department head", EXECUTIVE: "Executive" } as const;

export const TIMEZONES = [
  "Asia/Manila", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Tokyo", "Asia/Dubai", "Europe/London",
  "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney", "UTC",
];

// Time stamp buttons every organization starts with. Same for all industries (the clock is identical everywhere);
// the Super Admin can archive the optional ones and add their own in Settings.
export const DEFAULT_STAMP_TYPES: {
  key: string; name: string; icon: string; tone: string; kind: "IN" | "OUT" | "PAUSE"; paid: boolean;
  allowedMinutes?: number; requiresNote?: boolean; defaultContext?: "OFFICE" | "FIELD" | "REMOTE" | "CLIENT_SITE"; sortOrder: number; locked?: boolean;
}[] = [
  { key: "TIME_IN", name: "Time In", icon: "➡️", tone: "blue", kind: "IN", paid: true, sortOrder: 10, locked: true },
  { key: "BREAK", name: "Break", icon: "☕", tone: "amber", kind: "PAUSE", paid: true, allowedMinutes: 15, sortOrder: 20 },
  { key: "MEAL", name: "Meal", icon: "🍽️", tone: "indigo", kind: "PAUSE", paid: false, allowedMinutes: 60, sortOrder: 30 },
  { key: "BIO_BREAK", name: "Bio Break", icon: "🚻", tone: "slate", kind: "PAUSE", paid: true, allowedMinutes: 10, sortOrder: 40 },
  { key: "CLINIC_BREAK", name: "Clinic Break", icon: "🩺", tone: "teal", kind: "PAUSE", paid: true, allowedMinutes: 30, sortOrder: 50 },
  { key: "SYSTEM_ISSUE", name: "System Issue", icon: "⚠️", tone: "red", kind: "PAUSE", paid: true, requiresNote: true, sortOrder: 60 },
  { key: "ON_TRIP", name: "On Trip", icon: "📍", tone: "blue", kind: "PAUSE", paid: true, requiresNote: true, defaultContext: "FIELD", sortOrder: 70 },
  { key: "TIME_OUT", name: "Time Out", icon: "⬅️", tone: "slate", kind: "OUT", paid: true, sortOrder: 99, locked: true },
];

export const STAMP_ICONS = ["☕", "🍽️", "🚻", "🩺", "⚠️", "📍", "🚗", "🧑‍🏫", "📞", "💻", "🛠️", "🎓", "🏥", "📦", "⏸️", "🙏"];
export const STAMP_TONES = ["blue", "amber", "indigo", "slate", "teal", "red", "green", "violet", "pink"] as const;

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
// Every organization also gets "Field" (field and network teams) in its suggestions: see departmentSuggestionsFor.
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

export const departmentSuggestionsFor = (categoryKey: string) => [...(DEPARTMENT_SUGGESTIONS[categoryKey] ?? []), "Field"];

type PositionSuggestion = { title: string; level: keyof typeof LEVEL_LABEL; department?: string };
// Department heads and assistant heads are not suggested on their own: they always need a department, so they are added
// with the form (which asks which department), except where the suggestion names its department.
const FIELD_POSITIONS: PositionSuggestion[] = [
  { title: "Head Field / Network Engineer", level: "DEPT_HEAD", department: "Field" },
  { title: "Field Network Technician", level: "ENTRY", department: "Field" },
];
export const POSITION_SUGGESTIONS: Record<string, PositionSuggestion[]> = {
  government: [
    { title: "Administrative Aide", level: "ENTRY" }, { title: "Administrative Officer", level: "TEAM_LEAD" },
    { title: "Section Chief", level: "MANAGER" }, { title: "Municipal Administrator", level: "EXECUTIVE" },
  ],
  "bpo-it": [
    { title: "Agent", level: "ENTRY" }, { title: "Team Leader", level: "TEAM_LEAD" },
    { title: "Operations Manager", level: "MANAGER" }, { title: "Director", level: "EXECUTIVE" },
  ],
  healthcare: [
    { title: "Staff Nurse", level: "ENTRY" }, { title: "Charge Nurse", level: "TEAM_LEAD" },
    { title: "Nurse Manager", level: "MANAGER" }, { title: "Chief Operating Officer", level: "EXECUTIVE" },
  ],
};
const GENERIC_POSITIONS: PositionSuggestion[] = [
  { title: "Staff", level: "ENTRY" }, { title: "Team Leader", level: "TEAM_LEAD" },
  { title: "Manager", level: "MANAGER" }, { title: "Executive", level: "EXECUTIVE" },
];
export const positionSuggestionsFor = (categoryKey: string): PositionSuggestion[] => [...(POSITION_SUGGESTIONS[categoryKey] ?? GENERIC_POSITIONS), ...FIELD_POSITIONS];

export const LEVEL_LABEL = { ENTRY: "Entry level", TEAM_LEAD: "Team leader", MANAGER: "Manager", ASSISTANT_HEAD: "Assistant department head", DEPT_HEAD: "Department head", EXECUTIVE: "Executive" } as const;
// These levels always belong to one department: the form asks which.
export const DEPT_BOUND_LEVELS = ["ASSISTANT_HEAD", "DEPT_HEAD"] as const;

export const TIMEZONES = [
  "Asia/Manila", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Tokyo", "Asia/Dubai", "Europe/London",
  "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney", "UTC",
];

// Time stamp buttons every organization starts with. Same for all industries (the clock is identical everywhere);
// the Super Admin can archive the optional ones and add their own in Settings.
export const DEFAULT_STAMP_TYPES: {
  key: string; name: string; icon: string; tone: string; kind: "IN" | "OUT" | "PAUSE"; paid: boolean;
  allowedMinutes?: number; requiresNote?: boolean; defaultContext?: "OFFICE" | "FIELD" | "REMOTE" | "CLIENT_SITE"; sortOrder: number; locked?: boolean;
  page?: "PUNCH" | "ISSUE"; maxPerDay?: number; dailyCapMinutes?: number; requiresOvertimeOver?: number;
}[] = [
  { key: "TIME_IN", name: "Time In", icon: "➡️", tone: "blue", kind: "IN", paid: true, sortOrder: 10, locked: true },
  { key: "BREAK", name: "Break 1", icon: "☕", tone: "amber", kind: "PAUSE", paid: false, allowedMinutes: 15, maxPerDay: 1, sortOrder: 20 },
  { key: "BREAK_2", name: "Break 2", icon: "☕", tone: "amber", kind: "PAUSE", paid: false, allowedMinutes: 15, maxPerDay: 1, sortOrder: 21 },
  { key: "BREAK_3", name: "Break 3", icon: "☕", tone: "amber", kind: "PAUSE", paid: false, allowedMinutes: 15, maxPerDay: 1, requiresOvertimeOver: 120, sortOrder: 22 },
  { key: "MEAL", name: "Meal", icon: "🍽️", tone: "indigo", kind: "PAUSE", paid: false, allowedMinutes: 60, maxPerDay: 1, sortOrder: 30 }, // one 60-minute meal a work day
  { key: "BIO_BREAK", name: "Bio Break", icon: "🚻", tone: "slate", kind: "PAUSE", paid: false, dailyCapMinutes: 10, sortOrder: 40 },
  { key: "ON_TRIP", name: "On Trip", icon: "📍", tone: "blue", kind: "PAUSE", paid: true, defaultContext: "FIELD", sortOrder: 70 },
  { key: "CLINIC_BREAK", name: "Clinic Break", icon: "🩺", tone: "teal", kind: "PAUSE", paid: false, allowedMinutes: 30, page: "ISSUE", sortOrder: 50 },
  { key: "SYSTEM_ISSUE", name: "System Issue", icon: "⚠️", tone: "red", kind: "PAUSE", paid: false, requiresNote: true, page: "ISSUE", sortOrder: 60 },
  // Weather and calamities: they explain lost or interrupted work time. Same rows are added to existing organizations by migration.
  { key: "HEAVY_RAIN", name: "Heavy Rain / Flood", icon: "🌧️", tone: "blue", kind: "PAUSE", paid: false, page: "ISSUE", sortOrder: 61 },
  { key: "EXTREME_HEAT", name: "Extreme Heat", icon: "🌡️", tone: "amber", kind: "PAUSE", paid: false, page: "ISSUE", sortOrder: 62 },
  { key: "TYPHOON", name: "Typhoon / Storm Signal", icon: "🌀", tone: "indigo", kind: "PAUSE", paid: false, page: "ISSUE", sortOrder: 63 },
  { key: "EARTHQUAKE", name: "Earthquake", icon: "🫨", tone: "red", kind: "PAUSE", paid: false, page: "ISSUE", sortOrder: 64 },
  { key: "POWER_OUTAGE", name: "Power Outage", icon: "⚡", tone: "slate", kind: "PAUSE", paid: false, page: "ISSUE", sortOrder: 65 },
  { key: "CALAMITY", name: "Other Calamity", icon: "🆘", tone: "red", kind: "PAUSE", paid: false, requiresNote: true, page: "ISSUE", sortOrder: 66 },
  { key: "TIME_OUT", name: "Time Out", icon: "⬅️", tone: "slate", kind: "OUT", paid: true, sortOrder: 99, locked: true },
];

export const STAMP_ICONS = ["☕", "🍽️", "🚻", "🩺", "⚠️", "📍", "🚗", "🧑‍🏫", "📞", "💻", "🛠️", "🎓", "🏥", "📦", "⏸️", "🙏", "🌧️", "🌡️", "🌀", "🫨", "⚡", "🆘"];
export const STAMP_TONES = ["blue", "amber", "indigo", "slate", "teal", "red", "green", "violet", "pink"] as const;

// Which picture goes with which position. The picture itself is drawn by components/RoleArt.tsx.
// `icon` is a key into that component's icon table; `from` and `to` are the two ends of the gradient behind it.
export type RoleArtSpec = { icon: string; from: string; to: string; caption: string };

const ART: Record<string, RoleArtSpec> = {
  "Software Engineer: Front End": { icon: "code", from: "#0ea5e9", to: "#4f46e5", caption: "Interfaces people enjoy" },
  "Software Engineer: Back End": { icon: "server", from: "#4f46e5", to: "#7c3aed", caption: "Services and APIs" },
  "Software Engineer: Full Stack": { icon: "layers", from: "#7c3aed", to: "#db2777", caption: "From screen to database" },
  "Software Engineer: DevOps": { icon: "branch", from: "#059669", to: "#0d9488", caption: "Automate and release" },
  "Mobile App Developer": { icon: "phone", from: "#06b6d4", to: "#2563eb", caption: "Apps in every pocket" },
  "QA Engineer (Software Tester)": { icon: "bug", from: "#f59e0b", to: "#ea580c", caption: "Quality before release" },
  "UI/UX Designer": { icon: "pen", from: "#ec4899", to: "#e11d48", caption: "Designs that feel right" },
  "Data Analyst": { icon: "chart", from: "#2563eb", to: "#06b6d4", caption: "Data into decisions" },
  "Database Administrator": { icon: "database", from: "#475569", to: "#2563eb", caption: "Data kept safe and fast" },
  "Cybersecurity Analyst": { icon: "shield", from: "#dc2626", to: "#be123c", caption: "Defend what matters" },
  "IT Support Specialist": { icon: "headset", from: "#0d9488", to: "#0891b2", caption: "First line of help" },
  "Systems Administrator": { icon: "terminal", from: "#334155", to: "#0f766e", caption: "Servers that stay up" },
  "Cloud Engineer": { icon: "cloud", from: "#38bdf8", to: "#2563eb", caption: "Infrastructure in the cloud" },
  "Business Analyst (IT)": { icon: "clipboard", from: "#f97316", to: "#d97706", caption: "Needs into requirements" },
  "IT Project Manager": { icon: "kanban", from: "#4338ca", to: "#2563eb", caption: "Plans delivered on time" },
  "Network Administrator": { icon: "network", from: "#2563eb", to: "#4f46e5", caption: "Networks that connect" },
  "Safety Officer": { icon: "hardhat", from: "#eab308", to: "#ea580c", caption: "Everyone home safe" },
  "Office Staff": { icon: "briefcase", from: "#64748b", to: "#4f46e5", caption: "Keeps the office running" },
  "Marketing Staff": { icon: "megaphone", from: "#d946ef", to: "#ec4899", caption: "Tell our story" },
  "Human Resources Staff": { icon: "people", from: "#10b981", to: "#16a34a", caption: "People first" },
  "Field Helper": { icon: "wrench", from: "#78716c", to: "#d97706", caption: "Hands-on field work" },
  "Field Network Engineer": { icon: "cable", from: "#0891b2", to: "#0ea5e9", caption: "Fiber and links in the field" },
  "Field Line Man": { icon: "zap", from: "#facc15", to: "#f59e0b", caption: "Power lines, safely" },
  "Quality Officer": { icon: "badge", from: "#22c55e", to: "#059669", caption: "Standards we can prove" },
  "Admin Staff": { icon: "folder", from: "#475569", to: "#2563eb", caption: "Organized and on time" },
};

// A position HR added later still gets a fitting picture: matched by the words in its title.
const KEYWORDS: [RegExp, string][] = [
  [/cloud/i, "Cloud Engineer"], [/secur|cyber|soc\b|pentest|penetration/i, "Cybersecurity Analyst"], [/network|wi-?fi|noc\b|wireless/i, "Network Administrator"],
  [/database|dba\b|sql/i, "Database Administrator"], [/data|analyt|bi\b/i, "Data Analyst"], [/devops|sre\b|platform/i, "Software Engineer: DevOps"],
  [/mobile|android|ios/i, "Mobile App Developer"], [/front/i, "Software Engineer: Front End"], [/back/i, "Software Engineer: Back End"],
  [/engineer|developer|software|program/i, "Software Engineer: Full Stack"], [/design|ux|ui\b/i, "UI/UX Designer"], [/qa\b|test|quality assurance/i, "QA Engineer (Software Tester)"],
  [/support|help ?desk|service desk/i, "IT Support Specialist"], [/system|server|admin(istrator)? .*it/i, "Systems Administrator"], [/project|scrum|product/i, "IT Project Manager"],
  [/analyst/i, "Business Analyst (IT)"], [/market|brand|social|content/i, "Marketing Staff"], [/hr\b|human|recruit|people|talent/i, "Human Resources Staff"],
  [/safety|osh/i, "Safety Officer"], [/quality/i, "Quality Officer"], [/lineman|line man|power|electric/i, "Field Line Man"], [/field|technician|installer|helper/i, "Field Helper"],
  [/office|clerk|secretary|assistant|admin/i, "Admin Staff"],
];

const FALLBACK: RoleArtSpec = { icon: "briefcase", from: "#2563eb", to: "#4f46e5", caption: "Join our team" };

export function roleArt(title: string): RoleArtSpec {
  if (ART[title]) return ART[title];
  const hit = KEYWORDS.find(([re]) => re.test(title));
  return hit ? ART[hit[1]] : FALLBACK;
}

// Departments and positions for an information technology corporation: software, hardware, cloud, servers, networks,
// digital security and Wi-Fi services. Plain data (no database), so browser code may import it.

export type ItLevel = "ENTRY" | "TEAM_LEAD" | "MANAGER" | "ASSISTANT_HEAD" | "DEPT_HEAD" | "EXECUTIVE";
export type ItDepartment = { name: string; parent?: string };
export type ItPosition = { title: string; level: ItLevel; department: string };

export const IT_DEPARTMENTS: ItDepartment[] = [
  { name: "Executive Office" },
  { name: "Technology" },
  { name: "Software Engineering", parent: "Technology" },
  { name: "Cloud & Infrastructure", parent: "Technology" },
  { name: "Network & Wi-Fi Services", parent: "Technology" },
  { name: "Cybersecurity", parent: "Technology" },
  { name: "Data & Analytics", parent: "Technology" },
  { name: "Product & Design", parent: "Technology" },
  { name: "Quality Assurance", parent: "Technology" },
  { name: "IT Support", parent: "Technology" },
  { name: "Operations" },
  { name: "Field", parent: "Operations" },
  { name: "Sales & Business Development" },
  { name: "Marketing" },
  { name: "Procurement & Logistics" },
  { name: "Human Resources" },
  { name: "Training", parent: "Human Resources" },
  { name: "Finance" },
  { name: "Legal & Compliance" },
  { name: "Administration & Facilities" },
];

const P = (department: string, level: ItLevel, ...titles: string[]): ItPosition[] => titles.map((title) => ({ title, level, department }));

export const IT_POSITIONS: ItPosition[] = [
  ...P("Executive Office", "EXECUTIVE", "Chief Executive Officer", "Chief Operating Officer"),
  ...P("Executive Office", "ENTRY", "Executive Assistant"),
  ...P("Technology", "EXECUTIVE", "Chief Technology Officer"),
  ...P("Finance", "EXECUTIVE", "Chief Financial Officer"),
  ...P("Finance", "DEPT_HEAD", "Head of Finance"),
  ...P("Finance", "ENTRY", "Accountant", "Payroll Specialist"),

  ...P("Software Engineering", "DEPT_HEAD", "Head of Software Engineering"),
  ...P("Software Engineering", "ASSISTANT_HEAD", "Assistant Head of Software Engineering"),
  ...P("Software Engineering", "MANAGER", "Engineering Manager"),
  ...P("Software Engineering", "TEAM_LEAD", "Technical Lead"),
  ...P("Software Engineering", "ENTRY", "Software Engineer: Front End", "Software Engineer: Back End", "Software Engineer: Full Stack", "Mobile App Developer"),

  ...P("Cloud & Infrastructure", "DEPT_HEAD", "Head of Cloud & Infrastructure"),
  ...P("Cloud & Infrastructure", "MANAGER", "Infrastructure Manager"),
  ...P("Cloud & Infrastructure", "TEAM_LEAD", "DevOps Team Lead"),
  ...P("Cloud & Infrastructure", "ENTRY", "Software Engineer: DevOps", "Cloud Engineer", "Systems Administrator", "Database Administrator"),

  ...P("Network & Wi-Fi Services", "DEPT_HEAD", "Head of Network Services"),
  ...P("Network & Wi-Fi Services", "MANAGER", "Network Operations Manager"),
  ...P("Network & Wi-Fi Services", "TEAM_LEAD", "NOC Team Lead"),
  ...P("Network & Wi-Fi Services", "ENTRY", "Network Administrator", "NOC Engineer", "Wi-Fi / Wireless Engineer"),

  ...P("Cybersecurity", "EXECUTIVE", "Chief Information Security Officer"),
  ...P("Cybersecurity", "DEPT_HEAD", "Head of Cybersecurity"),
  ...P("Cybersecurity", "TEAM_LEAD", "SOC Team Lead"),
  ...P("Cybersecurity", "ENTRY", "Cybersecurity Analyst", "Security Engineer", "Penetration Tester"),

  ...P("Data & Analytics", "DEPT_HEAD", "Head of Data & Analytics"),
  ...P("Data & Analytics", "ENTRY", "Data Analyst", "Data Engineer"),

  ...P("Product & Design", "DEPT_HEAD", "Head of Product & Design"),
  ...P("Product & Design", "MANAGER", "Product Owner"),
  ...P("Product & Design", "ENTRY", "UI/UX Designer", "Business Analyst (IT)"),

  ...P("Quality Assurance", "DEPT_HEAD", "Head of Quality Assurance"),
  ...P("Quality Assurance", "TEAM_LEAD", "QA Team Lead"),
  ...P("Quality Assurance", "ENTRY", "QA Engineer (Software Tester)", "Quality Officer"),

  ...P("IT Support", "DEPT_HEAD", "Head of IT Support"),
  ...P("IT Support", "TEAM_LEAD", "Service Desk Team Lead"),
  ...P("IT Support", "ENTRY", "IT Support Specialist"),

  ...P("Operations", "DEPT_HEAD", "Head of Operations"),
  ...P("Operations", "ASSISTANT_HEAD", "Assistant Head of Operations"),
  ...P("Operations", "MANAGER", "IT Project Manager"),
  ...P("Operations", "ENTRY", "Project Coordinator", "Safety Officer"),

  ...P("Field", "DEPT_HEAD", "Head Field / Network Engineer"),
  ...P("Field", "TEAM_LEAD", "Field Supervisor"),
  ...P("Field", "ENTRY", "Field Network Technician", "Field Network Engineer", "Field Line Man", "Field Helper"),

  ...P("Sales & Business Development", "DEPT_HEAD", "Head of Sales & Business Development"),
  ...P("Sales & Business Development", "MANAGER", "Account Manager"),
  ...P("Sales & Business Development", "ENTRY", "Sales Executive", "Pre-Sales Engineer"),

  ...P("Marketing", "DEPT_HEAD", "Head of Marketing"),
  ...P("Marketing", "ENTRY", "Marketing Staff"),

  ...P("Procurement & Logistics", "DEPT_HEAD", "Head of Procurement & Logistics"),
  ...P("Procurement & Logistics", "ENTRY", "Procurement Officer", "Warehouse and Inventory Clerk"),

  ...P("Human Resources", "DEPT_HEAD", "Head of Human Resources"),
  ...P("Human Resources", "ENTRY", "Human Resources Staff"),
  ...P("Training", "ENTRY", "Learning and Development Specialist"),

  ...P("Legal & Compliance", "DEPT_HEAD", "Head of Legal & Compliance"),
  ...P("Legal & Compliance", "MANAGER", "Data Protection Officer"),
  ...P("Legal & Compliance", "ENTRY", "Legal Counsel", "Compliance Officer"),

  ...P("Administration & Facilities", "DEPT_HEAD", "Head of Administration & Facilities"),
  ...P("Administration & Facilities", "ENTRY", "Office Staff", "Admin Staff"),
];

// Departments and positions that are not in the organization yet. Used to tell HR what the button will add.
export function missingItOrg(departmentNames: string[], positionTitles: string[]) {
  const d = new Set(departmentNames.map((n) => n.toLowerCase()));
  const p = new Set(positionTitles.map((n) => n.toLowerCase()));
  return { departments: IT_DEPARTMENTS.filter((x) => !d.has(x.name.toLowerCase())).length, positions: IT_POSITIONS.filter((x) => !p.has(x.title.toLowerCase())).length };
}

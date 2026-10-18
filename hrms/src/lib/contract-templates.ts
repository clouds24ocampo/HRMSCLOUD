import { formatDay, keyOfDbDate } from "@/lib/time";

export type ContractTemplateKey = "REGULAR" | "PROBATIONARY" | "PROJECT_BASED" | "CONSULTANT";

export const CONTRACT_TEMPLATES: Record<ContractTemplateKey, { name: string; description: string; template: string }> = {
  REGULAR: {
    name: "Regular Employment Contract",
    description: "Standard Philippine Labor Code compliant contract for regular/permanent employees.",
    template: `EMPLOYMENT CONTRACT (REGULAR STATUS)

KNOW ALL MEN BY THESE PRESENTS:

This Employment Agreement is entered into this {{date_today}} by and between:

{{company_name}}, a corporation duly organized and existing under Philippine laws, with principal business address at Metro Manila, Philippines, represented herein by its authorized management, hereinafter referred to as the "COMPANY";

- and -

{{employee_name}}, of legal age, Filipino, residing at {{employee_address}}, hereinafter referred to as the "EMPLOYEE".

WITNESSETH:

1. APPOINTMENT AND POSITION
The COMPANY hereby engages the services of the EMPLOYEE as {{position}} assigned under the {{department}} Department, starting on {{start_date}}.

2. DUTIES AND RESPONSIBILITIES
The EMPLOYEE shall faithfully and efficiently perform the duties, responsibilities, and tasks inherent to the position of {{position}}, as well as such other duties as may be assigned from time to time by the COMPANY.

3. COMPENSATION AND BENEFITS
The COMPANY shall pay the EMPLOYEE a monthly basic salary of {{salary}}, payable semi-monthly on regular company payroll cutoff dates. In addition, the EMPLOYEE shall be entitled to mandatory Philippine statutory benefits:
- Social Security System (SSS)
- Philippine Health Insurance Corporation (PhilHealth)
- Home Development Mutual Fund (Pag-IBIG)
- 13th Month Pay in accordance with Presidential Decree No. 851
- Service Incentive Leaves (SIL) as provided by law

4. WORK HOURS AND SCHEDULE
The EMPLOYEE is expected to render at least forty (40) to forty-eight (48) hours of work per week, following the operational schedule assigned by the Department Head. All work timestamps shall be truthfully recorded on the official HRMS system.

5. COMPANY HANDBOOK AND CODE OF DISCIPLINE
The EMPLOYEE agrees to abide by all the rules, regulations, policies, and standard operating procedures set forth in the COMPANY HANDBOOK and Code of Conduct.

6. CONFIDENTIALITY AND NON-DISCLOSURE
The EMPLOYEE acknowledges that during employment, they will have access to confidential proprietary information, trade secrets, customer data, and source codes. The EMPLOYEE shall maintain utmost secrecy during and after employment.

IN WITNESS WHEREOF, the parties have executed this Agreement on the date and place first above written.

FOR THE COMPANY:
{{company_name}}

EMPLOYEE ACKNOWLEDGMENT & SIGNATURE:
{{employee_name}}
Address: {{employee_address}}
Position: {{position}}
Employee ID: {{employee_no}}`,
  },

  PROBATIONARY: {
    name: "Probationary Employment Agreement",
    description: "6-month probationary contract with explicit performance and regularization standards.",
    template: `PROBATIONARY EMPLOYMENT CONTRACT

KNOW ALL MEN BY THESE PRESENTS:

This Agreement is entered into this {{date_today}} by and between {{company_name}} ("COMPANY") and {{employee_name}}, residing at {{employee_address}} ("EMPLOYEE").

1. PROBATIONARY APPOINTMENT
The EMPLOYEE is hired under probationary status as {{position}} in the {{department}} Department for a period of six (6) months commencing on {{start_date}}.

2. STANDARDS FOR REGULARIZATION
The EMPLOYEE's performance, attendance adherence, teamwork, and technical competence shall be evaluated on the 3rd and 5th months. To qualify for regular employment, the EMPLOYEE must meet the following performance criteria:
- Minimum of 95% attendance adherence with no unexcused absences
- Satisfactory rating on quality of work, deliverables, and role KPIs
- Strict compliance with company handbook policies and security protocols

3. COMPENSATION
Monthly basic rate: {{salary}}, subject to statutory deductions (SSS, PhilHealth, Pag-IBIG, and withholding tax).

4. TERMINATION OF PROBATIONARY EMPLOYMENT
The COMPANY reserves the right to terminate employment at any time during the probationary period if the EMPLOYEE fails to qualify as a regular employee according to reasonable standards made known at the time of engagement, or for just/authorized causes provided by Philippine Labor Code.

FOR THE COMPANY:
{{company_name}}

EMPLOYEE CONFORME:
{{employee_name}}
Address: {{employee_address}}
Position: {{position}}
Date: {{date_today}}`,
  },

  PROJECT_BASED: {
    name: "Project-Based Employment Agreement",
    description: "Fixed-term or project-duration contract tied to specific client/software deliverables.",
    template: `PROJECT-BASED EMPLOYMENT CONTRACT

This Agreement is entered into this {{date_today}} by and between {{company_name}} and {{employee_name}}, residing at {{employee_address}}.

1. SCOPE OF PROJECT ENGAGEMENT
The EMPLOYEE is engaged as {{position}} specifically for the execution and completion of designated enterprise project deliverables under the {{department}} Department.

2. PERIOD OF ENGAGEMENT
Employment commences on {{start_date}} and shall automatically terminate upon substantial completion of the project phases or cessation of client project funding, without need for further notice.

3. COMPENSATION
The EMPLOYEE shall receive {{salary}}, payable semi-monthly through bank disbursement.

4. NO EXPECTATION OF REGULARIZATION
The EMPLOYEE acknowledges that their engagement is strictly coterminous with the project and does not confer regular employee status.

FOR THE COMPANY:
{{company_name}}

ACCEPTED AND AGREED:
{{employee_name}}
Address: {{employee_address}}
Date: {{date_today}}`,
  },

  CONSULTANT: {
    name: "Independent Contractor / Consultant Agreement",
    description: "Service contract for external specialists and consultants (no employer-employee relationship).",
    template: `INDEPENDENT CONTRACTOR / CONSULTANCY AGREEMENT

This Service Agreement is made this {{date_today}} between {{company_name}} ("CLIENT") and {{employee_name}}, residing at {{employee_address}} ("CONSULTANT").

1. ENGAGEMENT
CLIENT engages CONSULTANT to provide expert advisory and technical services as {{position}} for the {{department}} Department starting on {{start_date}}.

2. NATURE OF RELATIONSHIP
Nothing herein shall be construed to create an employer-employee relationship. CONSULTANT is an independent contractor and is solely responsible for their own tax obligations, local government licenses, and personal social security filings.

3. PROFESSIONAL FEES
CLIENT shall pay CONSULTANT a professional fee of {{salary}}, subject to applicable expanded withholding tax (EWT) upon submission of official invoice/receipt.

4. INTELLECTUAL PROPERTY
All work products, designs, algorithms, and documentation produced by CONSULTANT under this Agreement shall belong exclusively to CLIENT.

CLIENT:
{{company_name}}

CONSULTANT:
{{employee_name}}
Address: {{employee_address}}
Taxpayer/TIN on record: {{employee_no}}`,
  },
};

export type EmployeeContractData = {
  name: string;
  address: string;
  position: string;
  department: string;
  salary: string;
  startDate: string;
  employeeNo: string;
  companyName: string;
};

/**
 * Replace placeholders in template with exact employee details
 */
export function interpolateContract(template: string, data: EmployeeContractData): string {
  const today = formatDay(keyOfDbDate(new Date()), { month: "long", day: "numeric", year: "numeric" });
  return template
    .replace(/\{\{employee_name\}\}/g, data.name || "____________________")
    .replace(/\{\{employee_address\}\}/g, data.address || "____________________")
    .replace(/\{\{address\}\}/g, data.address || "____________________")
    .replace(/\{\{position\}\}/g, data.position || "Staff")
    .replace(/\{\{department\}\}/g, data.department || "Operations")
    .replace(/\{\{salary\}\}/g, data.salary || "As evaluated")
    .replace(/\{\{start_date\}\}/g, data.startDate || today)
    .replace(/\{\{employee_no\}\}/g, data.employeeNo || "N/A")
    .replace(/\{\{company_name\}\}/g, data.companyName || "Company")
    .replace(/\{\{date_today\}\}/g, today);
}

import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export const DEFAULT_HANDBOOK_SECTIONS = [
  {
    sortOrder: 1,
    slug: "welcome-and-mission",
    title: "1. Welcome & Company Philosophy",
    content: `Welcome to the team!

Our organization is committed to operational excellence, employee growth, and mutual trust. As an integral team member, your contribution directly drives our shared vision.

This Employee Handbook serves as your definitive guide to our company principles, workplace policies, statutory standards, code of conduct, and employment rights under Philippine Labor Standards.

Every employee is requested to read, understand, and comply with the provisions outlined herein.`,
  },
  {
    sortOrder: 2,
    slug: "hours-and-attendance",
    title: "2. Working Hours, Shifts & DTR Time-Stamping",
    content: `1. Regular Work Week:
Full-time personnel render forty (40) to forty-eight (48) hours of work per week, arranged across operational shifts established by management.

2. Daily Time Record (DTR):
All employees must record their actual time on duty using the official HRMS Time Clock system.
- Time In at the start of duty.
- Meal Break (out and in) during the mandatory 60-minute unpaid lunch period.
- Rest Breaks (15-minute paid rest intervals).
- Time Out upon conclusion of daily duty.

3. Flexible Schedule:
Employees designated on flexible arrangements are required to complete at least eight (8) working hours per scheduled day and preserve one (1) full day of rest every seven (7) days.

4. Geolocation & Verification:
Time stamps capture GPS and network verification. Punching or clocking for another person is strictly prohibited and constitutes gross misconduct.`,
  },
  {
    sortOrder: 3,
    slug: "punctuality-and-discipline",
    title: "3. Punctuality, Grace Period & Progressive Discipline Ladder",
    content: `1. Punctuality:
Prompt arrival is essential for business continuity. Employees should be logged in and ready for work at their designated shift start time.

2. Grace Period:
A grace period of up to 15 minutes is observed for unanticipated transit delays. Tardiness beyond the grace period will reflect on your Daily Time Record.

3. Four-Stage Progressive Disciplinary Ladder:
Unexcused tardiness, unauthorized undertime, or unapproved absences within an evaluation window are addressed progressively:
- 1st Offense: Verbal Counseling & Written Note
- 2nd Offense: Official Written Warning
- 3rd Offense: Suspension (1 to 5 working days depending on severity)
- 4th Offense: Dismissal / Separation for just cause under due process

4. Due Process:
Any disciplinary action shall adhere strictly to statutory procedural due process (Notice to Explain / Twin Notice Rule).`,
  },
  {
    sortOrder: 4,
    slug: "leaves-and-holidays",
    title: "4. Leaves & Holiday Entitlements",
    content: `1. Vacation & Sick Leaves:
Regular employees accrue paid leave credits in accordance with company policy and length of tenure. All leave requests must be filed in advance via the HRMS Leave portal.

2. Statutory Leaves under Philippine Law:
- 5 Days Service Incentive Leave (SIL)
- Maternity Leave (105 days with full pay under RA 11210)
- Paternity Leave (7 days paid leave under RA 8187)
- Solo Parent Leave (7 days under RA 8972)
- Special Leave for Women (Gynecological Surgery under RA 9710)
- VAWC Leave (10 days under RA 9262)

3. Regular & Special Holidays:
Work performed on Regular Holidays and Special Non-Working Holidays is compensated with premium pay rates as mandated by the Department of Labor and Employment (DOLE).`,
  },
  {
    sortOrder: 5,
    slug: "compensation-and-statutory",
    title: "5. Compensation, Cutoffs & Government Benefits",
    content: `1. Semi-Monthly Cut-off Periods:
- 1st Cut-off: 1st to 15th of the month (Paid on the 20th or 30th/31st).
- 2nd Cut-off: 16th to end of the month (Paid on the 10th or 15th of following month).

2. Mandatory Philippine Statutory Contributions:
The company dutifully withholds and matches required government contributions:
- Social Security System (SSS) & WISP
- Philippine Health Insurance Corporation (PhilHealth)
- Home Development Mutual Fund (Pag-IBIG / HDMF)
- Bureau of Internal Revenue (BIR Withholding Tax under TRAIN Law)

3. 13th Month Pay:
All eligible employees receive 13th month pay equivalent to one-twelfth (1/12) of their total basic salary earned during the calendar year, disbursed not later than December 24.`,
  },
  {
    sortOrder: 6,
    slug: "code-of-conduct",
    title: "6. Code of Conduct, Ethics & Harassment-Free Workplace",
    content: `1. Mutual Respect:
We maintain a safe, welcoming, and inclusive workplace free from discrimination, sexual harassment (Safe Spaces Act / RA 11313), and bullying.

2. Confidentiality & Intellectual Property:
All client information, trade secrets, software designs, customer data, and internal processes remain exclusive property of the company.

3. Conflict of Interest:
Employees must avoid outside business interests, secondary employment, or financial dealings that conflict with company obligations without prior written HR disclosure.`,
  },
  {
    sortOrder: 7,
    slug: "safety-and-emergencies",
    title: "7. Occupational Health, Calamity & Safety Protocols",
    content: `1. Workplace Health & Safety:
In compliance with Republic Act No. 11058 (OSH Standards), all employees must maintain safe premises, report hazards, and participate in emergency drills.

2. Calamity & Weather Disruptions:
In cases of typhoons, floods, earthquakes, or power outages, employees may tag their status via the HRMS 'Issue / Weather' stamp button and coordinate with supervisors for safety.`,
  },
  {
    sortOrder: 8,
    slug: "separation-and-clearance",
    title: "8. Separation, Resignation & Exit Clearance",
    content: `1. Resignation Notice:
Employees voluntarily resigning must submit at least thirty (30) days advance written notice through the HRMS portal to facilitate smooth handover.

2. Exit Clearance:
Returning company-issued assets, equipment, keys, and settling outstanding cash advances qualifies the employee for their Final Pay and Certificate of Employment (COE) within thirty (30) days of separation.`,
  },
];

/**
 * Ensures standard handbook sections exist for the organization
 */
export async function ensureHandbook(organizationId: string, companyName: string) {
  const count = await prisma.handbookSection.count({ where: { organizationId } });
  if (count > 0) return;

  await prisma.handbookSection.createMany({
    data: DEFAULT_HANDBOOK_SECTIONS.map((sec) => ({
      organizationId,
      sortOrder: sec.sortOrder,
      slug: sec.slug,
      title: sec.title,
      content: sec.content.replace(/the company/gi, companyName),
      version: 1,
    })),
  });
}

/**
 * Acknowledge handbook receipt
 */
export async function acknowledgeHandbook(employeeId: string, organizationId: string, version: number, note?: string, ip?: string) {
  const ack = await prisma.handbookAcknowledgment.upsert({
    where: { employeeId_version: { employeeId, version } },
    create: {
      organizationId,
      employeeId,
      version,
      signatureIp: ip,
      note: note?.trim() || "Acknowledged and agreed to company handbook",
    },
    update: {
      signedAt: new Date(),
      signatureIp: ip,
      note: note?.trim() || "Acknowledged and agreed to company handbook",
    },
  });

  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true, firstName: true, lastName: true } });
  if (emp?.userId) {
    await audit(
      emp.userId,
      "handbook.acknowledged",
      "HandbookAcknowledgment",
      ack.id,
      { employeeId, version, ip },
      organizationId,
    );
  }

  return ack;
}

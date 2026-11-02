// IT company handbook, part 1: foundations and the employment relationship.
// Plain text on purpose: the handbook page shows it as written. {{COMPANY}} is replaced with the organization's name.
export type Chapter = { slug: string; title: string; content: string };

export const PART1: Chapter[] = [
  {
    slug: "welcome-and-purpose",
    title: "1. Welcome, Purpose and How This Handbook Works",
    content: `1.1 Welcome
Welcome to {{COMPANY}} (the "Company"). We build and operate technology: software, hardware, cloud services, servers and networks, digital security services and Wi-Fi network services. Our customers trust us with their systems and their data. That trust is the most valuable thing the Company owns, and every employee helps protect it.

1.2 Purpose
This Handbook explains what the Company expects from you and what you can expect from the Company. It sets out the rules on employment, conduct, information security, data privacy, intellectual property and the safe delivery of our services. It also summarizes the Philippine laws that apply to us.

1.3 Who is covered
This Handbook applies to every director, officer, employee (regular, probationary, project, seasonal, casual and fixed-term), intern, trainee, and, to the extent stated in their contracts, every consultant, contractor, freelancer and agency worker who works for the Company or uses its systems ("Personnel"). Where a rule says "employees", it also applies to the other Personnel who are given access to Company systems or data.

1.4 Status of this Handbook
(a) This Handbook forms part of the terms and conditions of your work. It is read together with your employment contract, your confidentiality and intellectual property agreements, and the written policies the Company issues from time to time.
(b) If this Handbook conflicts with a law, a DOLE regulation, or a more favorable term in your written contract, the law or the more favorable contract term prevails, and the rest of the Handbook remains in force.
(c) This Handbook is not a promise of employment for any fixed period, and it does not limit the Company's right to manage its business (management prerogative), which the Company exercises in good faith and within the law.
(d) The Company may add to, change or withdraw any part of this Handbook. Changes are announced in writing (including through the HRMS) and take effect on the date stated. Continued work after a change takes effect means you accept it, except where the law requires your separate consent.

1.5 Your duty to read, ask and acknowledge
You must read this Handbook, ask HR when something is unclear, and sign the acknowledgment in the HRMS. Not having read it is not a defense. The Company keeps your acknowledgment as proof that you received and understood it.

1.6 Definitions
- "Company Systems": all computers, servers, cloud accounts, networks, Wi-Fi, software, email, messaging, storage, mobile devices, accounts and any other technology owned, leased, licensed or controlled by the Company or provided to you for work.
- "Company Information": all information that belongs to or is held by the Company, including business, financial, technical, source code, designs, customer, employee and supplier information, in any form.
- "Confidential Information": Company Information that is not public, including trade secrets, and information that customers and partners entrust to us.
- "Personal Data": any information from which a person can be identified, as defined in the Data Privacy Act of 2012 (RA 10173).
- "Customer Data": data that belongs to our customers and that we host, process, access or support.
- "Management": the Board of Directors, officers and the managers authorized to act for the Company.`,
  },
  {
    slug: "about-the-company",
    title: "2. About the Company: What We Do and What We Stand For",
    content: `2.1 What we do
The Company is an information and communications technology business. Our work includes:
- Software: designing, developing, testing, releasing and supporting software and mobile and web applications.
- Hardware: procuring, configuring, installing, repairing and supporting computers, servers, network equipment and related devices.
- Cloud services: designing, building and operating cloud infrastructure, hosting and managed services.
- Servers and data services: operating servers, storage, backup and disaster recovery services.
- Network services: designing, building and operating wired and wireless networks, internet access and connectivity services.
- Wi-Fi services: designing, installing, securing and managing Wi-Fi networks for the Company and for customers.
- Digital security: security assessments, monitoring, incident response, protection services and advice.

2.2 Our values
- Trust: we keep customer and employee information safe, and we keep our promises.
- Integrity: we are honest with customers, colleagues and regulators. We do not cut legal or ethical corners to win work.
- Competence: we do careful, tested, documented work. We say so when we do not know.
- Safety: we protect people first, then systems, then data, in that order.
- Respect: we treat everyone fairly and without harassment or discrimination.
- Accountability: we take responsibility for our work, report mistakes early and fix them.

2.3 Why rules matter in our business
A single mistake, such as a shared password, an unpatched server, an unauthorized scan or a lost laptop, can harm many customers at once and expose the Company and the individuals involved to civil, criminal and regulatory liability. The rules in this Handbook exist to prevent that. They are applied to everyone, including managers and directors.

2.4 Our legal position
The Company is a corporation. It acts only through authorized people (see Chapter 23). It must comply with the Revised Corporation Code, the Labor Code, the Data Privacy Act, the Cybercrime Prevention Act, tax and other laws, and it answers to the SEC, DOLE, the National Privacy Commission (NPC), the BIR, the NTC and other agencies where applicable.`,
  },
  {
    slug: "legal-framework",
    title: "3. Philippine Laws That Apply to Us (Quick Guide)",
    content: `3.1 How to use this chapter
This chapter lists the main Philippine laws behind the rules in this Handbook. It is a guide, not legal advice. Laws, implementing rules and circulars change. Where a law or an agency issuance is updated, the current version applies, and HR and the Legal function update this Handbook. If you are unsure whether something is lawful, ask before you act.

3.2 Employment and labor (DOLE)
- Labor Code of the Philippines (Presidential Decree 442, as amended and renumbered by RA 10151) and its Implementing Rules: hours of work, wages, holidays, leaves, security of tenure, termination, and employer records.
- Presidential Decree 851 (13th month pay) and its rules.
- Republic Act 6727 (Wage Rationalization Act) and Wage Orders of the Regional Tripartite Wages and Productivity Boards.
- Republic Act 7641 (Retirement Pay Law).
- Republic Act 11210 (105-Day Expanded Maternity Leave Law).
- Republic Act 8187 (Paternity Leave Act).
- Republic Act 8972 (Solo Parents' Welfare Act), as amended by RA 11861.
- Republic Act 9262 (Anti-Violence Against Women and Their Children Act): 10 days of leave for victims.
- Republic Act 9710 (Magna Carta of Women): special leave for women after gynecological surgery.
- Republic Act 11165 (Telecommuting Act) and its DOLE rules.
- Republic Act 10911 (Anti-Age Discrimination in Employment Act).
- Republic Act 7877 (Anti-Sexual Harassment Act) and Republic Act 11313 (Safe Spaces Act).
- Republic Act 11058 (Occupational Safety and Health Standards Law) and DOLE Department Order 198-18.
- Republic Act 11036 (Mental Health Act) and DOLE Department Order 208-20 (mental health in the workplace).
- Republic Act 11166 (Philippine HIV and AIDS Policy Act), and Republic Act 9165 (Comprehensive Dangerous Drugs Act) with DOLE Department Order 53-03 (drug-free workplace).
- DOLE Department Order 174-17 on contracting and subcontracting (labor-only contracting is prohibited).
- Republic Act 10396 and the Single Entry Approach (SEnA): conciliation-mediation of labor disputes.

3.3 Social contributions and tax
- Republic Act 11199 (Social Security Act of 2018).
- Republic Act 11223 (Universal Health Care Act) and PhilHealth rules.
- Republic Act 9679 (Home Development Mutual Fund Law of 2009, Pag-IBIG).
- National Internal Revenue Code, as amended by RA 10963 (TRAIN), RA 11534 (CREATE) and RA 11976 (Ease of Paying Taxes Act), and BIR regulations on withholding tax, invoicing, and books of accounts.

3.4 Data privacy, cyber and electronic transactions
- Republic Act 10173 (Data Privacy Act of 2012), its Implementing Rules and Regulations, and the circulars and advisories of the National Privacy Commission (NPC), including those on data breach management (NPC Circular 16-03), data sharing (NPC Circular 20-01), and the registration of Data Protection Officers and data processing systems (NPC Circular 2022-04).
- Republic Act 10175 (Cybercrime Prevention Act of 2012).
- Republic Act 8792 (Electronic Commerce Act of 2000), and the Rules on Electronic Evidence.
- Republic Act 4200 (Anti-Wiretapping Act).
- Republic Act 9995 (Anti-Photo and Video Voyeurism Act).
- Republic Act 11934 (SIM Registration Act), where the Company's services involve SIM-based services.

3.5 Intellectual property
- Republic Act 8293 (Intellectual Property Code of the Philippines), as amended, covering copyright, patents, trademarks and related rights.
- Article 292 of the Revised Penal Code (revelation of industrial secrets) and the Civil Code provisions on contracts, damages and abuse of rights.

3.6 Corporate, competition and integrity
- Republic Act 11232 (Revised Corporation Code of the Philippines) and the rules of the Securities and Exchange Commission (SEC).
- Republic Act 10667 (Philippine Competition Act).
- Republic Act 3019 (Anti-Graft and Corrupt Practices Act), Republic Act 6713 (Code of Conduct and Ethical Standards for Public Officials and Employees), and Articles 210 to 212 of the Revised Penal Code on bribery, when we deal with the government.
- Republic Act 12009 (New Government Procurement Act), when we sell to government agencies.
- Republic Act 9160 (Anti-Money Laundering Act), as amended, where it applies to the Company's dealings.

3.7 Telecommunications, equipment and environment
- Republic Act 7925 (Public Telecommunications Policy Act), Republic Act 3846 (Radio Control Law) and the regulations of the National Telecommunications Commission (NTC) and the Department of Information and Communications Technology (DICT), including licenses, registrations and type approval of equipment, and the Konektadong Pinoy (Open Access in Data Transmission) law where it applies to our licenses.
- Republic Act 6969 (Toxic Substances and Hazardous and Nuclear Wastes Control Act), Republic Act 9003 (Ecological Solid Waste Management Act) and DENR rules on electronic waste.

3.8 Consumer and contracts
- The Civil Code of the Philippines on obligations and contracts, Republic Act 7394 (Consumer Act), and the rules on electronic signatures and documents.`,
  },
  {
    slug: "employment-basics",
    title: "4. Hiring, Employment Status and Onboarding",
    content: `4.1 Equal opportunity
The Company hires and promotes on merit: skills, experience, integrity and fit for the role. We do not discriminate because of sex, gender, sexual orientation, age (RA 10911), civil status, religion, ethnicity, disability, political belief, union membership, or any other ground that the law protects.

4.2 Pre-employment requirements
Applicants submit the documents HR asks for, such as a resume, valid government ID, NBI or police clearance, TIN, SSS, PhilHealth and Pag-IBIG numbers, diplomas and certificates, and previous employment records. The Company may verify these with the applicant's knowledge and, where required, consent. Giving false or forged documents or false information is a ground for refusing or ending employment.

4.3 Background and security screening
Because Personnel handle customer systems and sensitive data, the Company may run background checks that are lawful, relevant to the role and proportionate (for example, employment verification and criminal record checks). They are done only after notice to you and, where the Data Privacy Act requires it, with your consent. The results are kept confidential.

4.4 Employment status
(a) Probationary: up to six (6) months from the first day of work, unless a longer period is allowed by law. The Company tells you the standards for becoming regular at the start. Employees who meet them become regular. Employees who do not may be separated at the end of the period, with written notice.
(b) Regular: employees who finished probation, or who perform work that is usually necessary or desirable to the business.
(c) Project and fixed-term: employees hired for a specific project or a period that is stated in the contract. Employment ends when the project is finished or the term ends, as provided by law and the contract.
(d) Seasonal and casual: as defined by the Labor Code.
(e) Consultants, contractors and freelancers: independent contractors who are not employees. They work under a written services agreement. The Company does not engage in labor-only contracting (DOLE Department Order 174-17). Agencies and subcontractors must be legitimate and registered.

4.4.1 Interns and trainees
Interns and trainees follow this Handbook for conduct, security, confidentiality and intellectual property, and sign the Company's NDA and IP agreement before getting access.

4.5 Employment contract and job description
Every employee receives a written contract and job description. Management may assign you to other work that is reasonably related to your role, and may transfer or reassign you in good faith for business reasons, without demotion in rank or reduction of salary and benefits.

4.6 Records (201 file)
HR keeps an employment record for each employee. You must tell HR within a reasonable time of changes to your name, address, contact details, civil status, dependents and emergency contacts. Personal data in your file is protected under Chapter 13.

4.7 Onboarding
New employees attend orientation on this Handbook, information security, data privacy, occupational safety and health (the mandatory 8-hour OSH orientation under DOLE rules), and the tools and processes of their team. Access to production systems and customer data is granted only after the required orientation and signed agreements are complete.

4.8 Orientation checklist
Before access to Company Systems is granted, you must have: signed the employment contract; acknowledged this Handbook; signed the confidentiality (NDA) and intellectual property assignment agreements; received the Privacy Notice for Employees; and completed the security awareness training.`,
  },
  {
    slug: "hours-attendance",
    title: "5. Working Hours, Attendance and Time Records",
    content: `5.1 Normal hours
The normal workday is eight (8) hours, excluding the meal break. Schedules are set by Management and may include shifts, including night shifts for operations teams (for example, the network operations center). Schedules are recorded in the HRMS.

5.2 Meal and rest breaks
A meal break of at least sixty (60) minutes is given and is not paid unless the Company decides otherwise or you must stay on duty. Short rest breaks (up to 20 minutes) are counted as working time. Weekly rest: at least 24 consecutive hours after six consecutive working days.

5.3 Flexible and compressed schedules
Where the Company approves a flexible or compressed workweek, you must complete the required total hours, and the arrangement does not reduce your pay or statutory benefits. Management can end or change the arrangement for business needs with notice.

5.4 Time stamps and the Daily Time Record (DTR)
(a) Record your time in the HRMS: time in, meal out and in, and time out, at the start and end of each shift. The system records the time, device and, where the Company has notified you, location information.
(b) Only you may record your own time. Recording time for another person, or asking another person to record yours, is dishonesty and a grave offense for both.
(c) Falsifying a time record, location, or any attendance record is a grave offense.
(d) If you forget to record, file a correction request in the HRMS with the reason. Your supervisor and HR review it.

5.5 Tardiness and undertime
Arriving late or leaving early is recorded. A short grace period may apply as stated in the HRMS settings. Repeated tardiness and undertime are handled under Chapter 11. Pay for time not worked is deducted according to law and company policy.

5.6 Overtime
(a) Overtime must be approved in advance in the HRMS by your supervisor unless it is an emergency. Work done without approval is not guaranteed overtime pay, but employees must still be paid for work the Company knowingly allowed. Unauthorized overtime may be subject to discipline.
(b) Overtime pay: at least 25% above the hourly rate on an ordinary working day. On rest days, special days and holidays, the higher rates provided by the Labor Code apply.
(c) Night shift differential: employees who work between 10:00 PM and 6:00 AM receive at least an additional 10% of their regular wage for each hour of work in that period.
(d) Managerial employees, certain field personnel, and others exempted by the Labor Code are not entitled to overtime, holiday and similar pay, as allowed by law.

5.7 On-call, standby and incident response
Operations staff may be assigned on-call or standby duty. The Company decides in advance and in writing how on-call time is paid or compensated. When you are called to work, the time you actually work is working time. You must respond within the response time that applies to your team.

5.8 Holidays
Regular holidays and special days follow the proclamations and DOLE rules. Holiday pay and premium pay are computed as the Labor Code and DOLE advisories require, and are shown in your payslip.

5.9 Absences
Report an absence to your supervisor as early as possible, and no later than the start of your shift unless it is impossible. File the leave in the HRMS. An absence without notice or approval is an unauthorized absence. Absence without leave for an extended period, or leaving the post without approval, may amount to abandonment of work, following the notice and due process steps in Chapter 11.`,
  },
  {
    slug: "pay-benefits",
    title: "6. Compensation, Payroll and Benefits",
    content: `6.1 Pay and pay periods
Salaries are paid at least twice a month, within the schedule shown in the HRMS, by the means chosen by the Company (such as bank transfer). Your payslip shows gross pay, each deduction and net pay. You can check your payslip in the HRMS. Tell HR within 30 days if you see an error so it can be corrected.

6.2 Minimum wage and pay structure
The Company pays at least the minimum wage that applies to its location under the Wage Orders. Pay may include basic salary, allowances, incentives and commissions as stated in your contract. Incentives, bonuses and allowances that are not required by law or contract are discretionary and are given on the terms announced.

6.3 Deductions
The Company deducts from wages only: (a) amounts required by law (withholding tax, SSS, PhilHealth, Pag-IBIG); (b) amounts you authorized in writing for a lawful purpose (such as loans and cash advances); (c) amounts allowed by the Labor Code or DOLE rules, including for loss or damage to Company property only when the rules on due process and the Labor Code conditions are met; and (d) amounts ordered by a court or authority. Other deductions are not made.

6.4 Statutory contributions and tax
The Company withholds and remits SSS, PhilHealth, Pag-IBIG and income tax as required by law, and issues the BIR withholding certificate (Form 2316) each year. Your contribution numbers must be provided and kept correct.

6.5 13th month pay
Rank-and-file employees receive 13th month pay of at least one-twelfth (1/12) of the basic salary earned within the calendar year, paid not later than December 24, under Presidential Decree 851. Employees who resign or are separated receive it in proportion to the time worked.

6.6 Service incentive leave and other statutory leaves
See Chapter 7.

6.7 Retirement
Employees may retire and receive retirement pay under the Company's retirement plan or, where there is none, under the Retirement Pay Law (RA 7641): optional retirement at age 60 and compulsory retirement at 65, with at least five (5) years of service, and retirement pay of at least one-half (1/2) month salary for every year of service.

6.8 Pay confidentiality
Payroll data is confidential. HR, payroll and authorized managers only may see pay information of other employees. You must not look up or share another person's pay information. You may discuss your own pay.

6.9 Cash advances and loans
Cash advances and employee loans require written approval and a written agreement for repayment through payroll. Unpaid balances are settled from final pay as the law allows.

6.10 Taxable and non-taxable benefits
Benefits are taxed as the National Internal Revenue Code provides, including the exemption on 13th month pay and other benefits up to the amount set by law (currently ₱90,000).

6.11 Expense reimbursement
Business expenses are reimbursed against receipts, within the budget and rules in Chapter 21.`,
  },
  {
    slug: "leaves",
    title: "7. Leaves of Absence",
    content: `7.1 How to apply
File every leave in the HRMS before the leave, except in emergencies, when you must tell your supervisor as early as possible and file as soon as you return. Approval depends on the leave type and the needs of the work. Leave for statutory reasons is granted as the law requires.

7.2 Leaves under company policy
Vacation, sick and other leaves, their number, accrual, carry-over and cash conversion follow the Company's leave policy in the HRMS. Unused leaves convert to cash only as the policy or the law provides.

7.3 Service incentive leave (SIL)
Employees who have rendered at least one year of service are entitled to five (5) days of leave with pay each year, unless they already enjoy at least five (5) days of paid vacation leave under company policy. Unused SIL is convertible to cash at the end of the year.

7.4 Maternity leave (RA 11210)
Female employees are entitled to 105 days of maternity leave with pay for live childbirth (120 days for a solo parent), with an option to extend for 30 days without pay, and 60 days for miscarriage or emergency termination of pregnancy. Up to seven (7) days may be allocated to the child's father or an alternate caregiver. Notify HR and submit the required documents.

7.5 Paternity leave (RA 8187)
Married male employees are entitled to seven (7) days of paternity leave with pay for each of the first four deliveries of their lawful spouse who is living with them.

7.6 Solo parent leave
Qualified solo parents are entitled to seven (7) working days of parental leave each year (RA 8972, as amended by RA 11861), subject to the required documents.

7.7 Violence Against Women and Their Children (RA 9262)
Women employees who are victims of violence are entitled to leave of up to ten (10) days with pay, extendable as the court orders. Their information is strictly confidential.

7.8 Special leave for women (RA 9710)
Women employees who undergo surgery for gynecological disorders are entitled to special leave of up to two (2) months with full pay, subject to the law's requirements.

7.9 Other leaves
The Company may grant bereavement, emergency and other leaves under its policy, and unpaid leave for personal reasons at Management's discretion.

7.10 Medical certificates
Sick leave of more than the number of days stated in policy must be supported by a medical certificate. Medical information is sensitive personal information and is kept by HR only (see Chapter 13).

7.11 Abuse of leave
Using leave for a different purpose than stated, false medical documents, or leave taken after it was denied are disciplinary offenses.`,
  },
  {
    slug: "work-arrangements",
    title: "8. Remote Work, Field Work and On-Site Work",
    content: `8.1 Telecommuting (RA 11165)
Where the Company approves work from home or another remote location, you receive the same pay, benefits, treatment, training and career opportunities as on-site employees, as the Telecommuting Act provides. Remote work is voluntary on your part where the law says so, and is governed by a written telecommuting agreement that states hours, equipment, expenses and security rules.

8.2 Rules for remote work
(a) Work in a safe place and follow the same working hours and time-stamp rules unless your agreement says otherwise.
(b) Use only Company-approved devices, accounts and secure connections (VPN where required). Do not work on customer or Company Confidential Information on public Wi-Fi without the VPN.
(c) Keep screens and conversations private. Family and visitors must not see Confidential Information.
(d) Lock your device whenever you step away. Do not leave devices unattended in vehicles or public places.
(e) Occupational safety rules (Chapter 20) apply to your remote workplace to the extent the Company can reasonably control. Report work-related injuries.
(f) The Company may inspect or request evidence of security measures for devices that hold Company data, with notice.

8.3 Equipment and expenses
The Company provides, or reimburses for, equipment and agreed expenses as stated in the telecommuting agreement. Company equipment remains Company property and must be returned on request or on separation.

8.4 Field work and customer sites
Employees who work at customer sites represent the Company. You must follow the customer's site safety and security rules in addition to ours, keep to the written scope of work, and not access any system or data that you are not authorized to access. Report any concern to your supervisor immediately.

8.5 Travel
Business travel needs prior approval and follows Chapter 21. Travel time is working time as the law provides.

8.6 Bring your own device (BYOD)
Personal devices may be used for Company work only if approved by IT and enrolled in the Company's device management. IT may require a screen lock, encryption and the ability to remotely wipe Company data. The Company does not access your personal content, and you must not store Company data in personal accounts. If you leave, Company data is removed from your device.

8.7 Right to rest
Outside your schedule, you are not expected to respond to non-urgent messages. Operations teams on call follow Section 5.7.`,
  },
];

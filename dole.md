. If the objective is to make the HRMS legally knowledgeable about Philippine employment, payroll, labor standards, contractors/subcontractors, workplace safety, benefits, and compliance, I recommend we build a Philippine Labor & Employment Legal Knowledge Base inside the system.

The important point is: do not hard-code “DOLE law” directly into payroll or HR screens. Laws change. Your HRMS needs a versioned legal/rules engine.

1. The legal hierarchy the HRMS should understand

The system should classify every rule by authority:

CONSTITUTION
    ↓
REPUBLIC ACTS / LAWS
    ↓
PRESIDENTIAL DECREES / EXECUTIVE ORDERS
    ↓
LABOR CODE
    ↓
IMPLEMENTING RULES & REGULATIONS
    ↓
DOLE DEPARTMENT ORDERS
    ↓
DOLE LABOR ADVISORIES / MEMORANDA / CIRCULARS
    ↓
NWPC / REGIONAL WAGE ORDERS
    ↓
SSS / PhilHealth / Pag-IBIG / ECC / BIR rules
    ↓
CSC / GSIS rules for government employees
    ↓
COLLECTIVE BARGAINING AGREEMENT
    ↓
EMPLOYMENT CONTRACT
    ↓
COMPANY POLICY

The HRMS should never assume that a company policy can override a statutory minimum.

The DOLE's own 2022 renumbered Labor Code is the starting point and contains Books I through VII, covering pre-employment, human-resource development, conditions of employment, occupational safety/social welfare, labor relations, post-employment, and final provisions.

Official DOLE Labor Code — Renumbered DOLE Edition 2022

2. The master HRMS legal library

I would create these legal domains.

Domain	HRMS knowledge required
Employment relationship	Employer/employee tests, employment status
Hiring	Recruitment, discrimination, foreign workers
Contracts	Regular, probationary, project, seasonal, fixed-term
Working time	Hours, schedules, rest periods
Attendance	Late, undertime, absence, work schedules
Overtime	OT eligibility and computation
Night work	Night shift differential
Holidays	Regular/special holidays
Premium pay	Rest day, special day, holiday
Wages	Minimum wage, wage deductions
Payroll	Gross/net pay, statutory deductions
Benefits	13th month, SIL, maternity, paternity, etc.
Leave	Statutory and company leaves
Social insurance	SSS, PhilHealth, Pag-IBIG
Employees' Compensation	ECC/ECP
Occupational safety	OSH
Construction safety	Construction-specific OSH
Contractors	DO 174
Subcontractors	DO 174
Labor-only contracting	Detection/prevention
Recruitment	Illegal recruitment and licensing
Termination	Authorized/just causes
Separation pay	Legal computation
Retirement	RA 7641
Labor relations	Unions/CBA/ULP
Disciplinary process	Due process
Anti-discrimination	Sex, age, disability, HIV, etc.
Anti-harassment	Sexual/gender-based harassment
Data privacy	Employee information
Telecommuting	RA 11165
Domestic workers	Batas Kasambahay
Special workers	Apprentices, learners, minors
Government employees	CSC/GSIS
Tax	BIR compensation taxation
Professional licensing	PRC/TESDA
Labor disputes	SEnA/NLRC
Compliance inspection	DOLE LLCS
Jurisprudence	Supreme Court labor cases
3. The most important book: DOLE Workers' Statutory Benefits Handbook

DOLE/NWPC publishes the Handbook on Workers' Statutory Monetary Benefits.

The current official version I found is the 2024 Edition, and it specifically incorporates updated wage orders and changes such as DOLE Department Order 242-2024 on service charges.

DOLE/NWPC Workers' Statutory Monetary Benefits Handbook 2024

This should become one of the HRMS's primary reference documents, but not the ultimate legal authority.

For example:

Law
  ↓
DOLE IRR
  ↓
DOLE/NWPC Handbook
  ↓
HRMS calculation rule

The handbook explains the law; it doesn't replace the law.

4. Labor Code — Books I to VII

The HRMS legal engine should index the Labor Code by Book → Title → Chapter → Article.

Book I — Pre-Employment

Include:

recruitment and placement
private recruitment agencies
overseas employment
employment of non-resident aliens
employment discrimination
foreign workers
recruitment licensing
illegal recruitment
Book II — Human Resources Development

Include:

national manpower development
apprenticeship
learnership
training
special workers
Book III — Conditions of Employment

This is one of the most important HRMS sections.

Include:

working conditions
normal hours
rest periods
weekly rest day
wages
minimum wage
wage deductions
payroll records
holiday pay
premium pay
overtime
night shift differential
service incentive leave
service charges
13th month pay
women workers
minors
domestic workers/special workers where applicable
Book IV — Health, Safety and Social Welfare

Include:

occupational safety
health standards
employees' compensation
work-related injury
work-related illness
ECC
SSS/ECP
medical services
Book V — Labor Relations

Include:

right to self-organization
unions
collective bargaining
CBA
unfair labor practices
strikes
lockouts
grievance machinery
voluntary arbitration
labor organizations
Book VI — Post-Employment

Include:

termination
just causes
authorized causes
procedural due process
separation pay
retirement
abandonment
redundancy
retrenchment
closure
resignation
Book VII — Final Provisions

Include:

penalties
liabilities
prescription
enforcement
transitory rules.

DOLE's official Labor Code page provides the renumbered 2022 edition organized this way.

5. Critical Republic Acts for the HRMS

These should become structured legal records.

Employment / working arrangements
RA 11165 — Telecommuting Act

Your HRMS needs:

Work Arrangement
    OFFICE
    HYBRID
    TELECOMMUTING
    REMOTE
    FLEXIBLE

RA 11165 requires telecommuting arrangements to maintain minimum labor standards, including compensable work hours, overtime, rest days and leave benefits.

RA 11165 — Telecommuting Act

Maternity
RA 11210 — Expanded Maternity Leave Law

HRMS must understand:

105 days
miscarriage/ETP
solo-parent additional benefit
optional additional unpaid leave
SSS requirements
employer advance
maternity notification
maternity benefit computation.

RA 11210 — Expanded Maternity Leave Law

6. Batas Kasambahay
RA 10361

This is a separate labor regime for domestic workers.

HRMS should have:

Employment Type
    REGULAR
    PROBATIONARY
    PROJECT
    SEASONAL
    FIXED_TERM
    DOMESTIC_WORKER
    APPRENTICE
    LEARNER
    OTHER

RA 10361 establishes specific protections and labor standards for domestic workers.

RA 10361 — Batas Kasambahay

7. Service charges
RA 11360

This is extremely important for companies such as:

hotels
restaurants
similar establishments.

RA 11360 amended Article 96 and provides for full distribution of covered service charges among covered employees, excluding managerial employees.

Then DOLE issued Department Order 242-24, revising the implementing rules.

Your HRMS therefore needs:

Service Charge Pool
       ↓
Covered Employees
       ↓
Eligible Distribution
       ↓
Payroll

Not simply:

Service Charge → Company Revenue
8. Solo Parent law
RA 11861

This needs its own employee eligibility engine.

The law expanded the categories of solo parents and provides additional benefits, including parental leave and other social protection benefits.

RA 11861 — Expanded Solo Parents Welfare Act

HRMS:

Employee
  ↓
Solo Parent Status
  ↓
Validate supporting documents
  ↓
SPIC
  ↓
Eligible Benefits
  ↓
Leave / Payroll / Benefits
9. Anti-discrimination

The HRMS should have a protected employment attributes / compliance engine, but it should not expose sensitive information unnecessarily.

Important laws include:

RA 10911

Anti-Age Discrimination in Employment Act.

RA 6725

Prohibiting discrimination against women in terms and conditions of employment.

RA 9710

Magna Carta of Women.

RA 7877

Anti-Sexual Harassment Act.

RA 11313

Safe Spaces Act.

RA 11313 specifically covers gender-based sexual harassment in workplaces and recognizes employees detailed through subcontracting/secondment arrangements for purposes of the Act.

RA 11313 — Safe Spaces Act

10. Occupational Safety and Health

This needs to be a major HRMS module, particularly because your system also needs to understand contractors and construction.

RA 11058

This covers occupational safety and health requirements.

It applies to establishments, projects, sites and other workplaces, with specified public-sector exclusions, and expressly includes employers, contractors and subcontractors within important OSH obligations.

The law requires things such as:

OSH program
safety and health committee
safety officers
occupational health personnel
first aid
worker training
PPE
safety signage
emergency response
incident investigation
reporting
worker right-to-know
competency requirements.

RA 11058 — Occupational Safety and Health Standards Law

Very important current update

DOLE issued Department Order 252-25, the revised IRR of RA 11058. DOLE's OSHC currently lists it as the revised OSH IRR.

DOLE Occupational Safety and Health Center — Department Orders

11. Construction workers

Because your business/project environment can involve construction and subcontractors, the HRMS should additionally understand:

DOLE Department Order 13, s. 1998

Construction Industry OSH Guidelines.

DOLE specifically identifies DO 13 as prescribing OSH guidelines for the construction industry.

DOLE Department Order 253-25

Current guidelines for temporary accommodation and welfare facilities for construction workers.

This should become:

Project
 ├── Principal
 ├── Contractor
 ├── Subcontractor
 ├── Workers
 ├── Safety Officers
 ├── OSH Program
 ├── PPE
 ├── Training
 ├── Incidents
 ├── Medical
 ├── Welfare Facilities
 └── Compliance
12. CONTRACTOR / SUBCONTRACTOR — extremely important

This deserves a dedicated HRMS subsystem.

DOLE Department Order 174-17

Rules Implementing Articles 106 to 109 of the Labor Code, as amended.

It governs contracting and subcontracting arrangements.

DOLE Department Order 174-17 — Contracting/Subcontracting Rules

DOLE states that DO 174:

prohibits labor-only contracting
permits legitimate contracting/subcontracting
requires contractor/subcontractor registration
establishes worker protections
addresses security of tenure
regulates service agreements
provides registration/cancellation procedures.
13. HRMS Contractor Compliance Engine

I recommend creating this exact concept.

CONTRACTOR
    │
    ├── SEC / DTI / CDA Registration
    ├── Mayor's Permit / Business Permit
    ├── DOLE DO 174 Registration
    ├── Certificate of Registration
    ├── Registration Validity
    ├── Tools & Equipment
    ├── Facilities
    ├── Capital / Financial Capacity
    ├── Employees
    ├── Payroll
    ├── SSS
    ├── PhilHealth
    ├── Pag-IBIG
    ├── OSH
    ├── Safety Officers
    ├── Service Agreements
    ├── Semi-Annual Reports
    ├── Sworn Disclosures
    └── Compliance Status

The DOLE registration requirements include corporate/business registration, permits and certified listings of facilities, tools, equipment, premises and machinery actually and directly used by the contractor.

14. Contractor relationship model

The HRMS must distinguish:

Employee
Company
    ↓
Employee

versus:

Legitimate subcontracting
PRINCIPAL
    ↓
SERVICE AGREEMENT
    ↓
CONTRACTOR
    ↓
CONTRACTOR EMPLOYEES

The HRMS should not automatically classify every contractor worker as the principal's employee.

It should instead perform a compliance assessment based on:

Who hired?
Who pays?
Who controls?
Who supervises?
Who provides tools?
Who owns equipment?
Who has capital?
Who bears entrepreneurial risk?
Who determines manner/method?
What is the service agreement?
Is contractor registered?
Is contractor independently operating?

This is particularly important because employment classification can ultimately involve legal/judicial interpretation.

15. DOLE Contractor Registry

This is now something the HRMS should actually be able to track.

DOLE has a Contracting & Subcontracting Registry System (CSRS). The current registry provides contractor/subcontractor registration and a public list of currently valid registered contractors/subcontractors in NCR.

DOLE Contracting & Subcontracting Registry System

DOLE-NCR announced in March 2026 that applications under DO 174 must be submitted through CSRS.

That means your HRMS should have:

DO174 Registration No.
Registration Date
Expiry Date
Region
Status
Certificate
Verification URL
Last Verification Date

and an automatic warning:

VALID
EXPIRING SOON
EXPIRED
SUSPENDED
CANCELLED
NOT VERIFIED
16. DOLE compliance / inspection

The HRMS should also understand DOLE labor inspection.

Current DOLE references include:

DOLE Department Order 238-23

Rules on administration and enforcement of labor standards under Article 128.

DOLE Department Order 183-17

Earlier revised rules.

DOLE Department Order 131-B-16

Labor Laws Compliance System.

DOLE regional guidance identifies these as legal bases for labor standards compliance/enforcement.

This means we should build:

Compliance Dashboard

Labor Standards
├── Wages
├── Hours
├── Leave
├── Benefits
├── Payroll
├── Records
└── Employment Status

OSH
├── OSH Program
├── Safety Officer
├── First Aid
├── PPE
├── Training
├── Incidents
└── Emergency

Contracting
├── Contractor Registration
├── Service Agreements
├── Worker Records
├── Payroll
├── OSH
└── Semi-Annual Reports
17. Current DOLE issuance library

This is important because the Labor Code alone is nowhere near enough.

DOLE's current Department Order repository includes, among others:

DO 259-26 — Violence and Harassment in the Workplace
DO 258-26 — Free Legal Assistance for Workers
DO 257-26 — National Academy of Labor Justice
DO 256-26 — revised IRR of Tripartism Law
DO 254-25 — Caregivers' Welfare Act IRR
DO 253-25 — construction worker temporary accommodation/welfare
DO 252-25 — revised OSH IRR
DO 251-25 — Article 133/135 rules concerning women
DO 249-25 — conciliation-mediation
DO 248/248A/248B — foreign nationals
DO 247-25 — execution of NLRC/VA decisions related to seafarers
DO 246-24 — movie/television industry workers
DO 242-24 — service charges
DO 238-23 — labor standards enforcement
DO 237-22 — Telecommuting Act IRR
and many others.

DOLE Department Orders — Official Repository

DOLE Bureau of Working Conditions — Department Orders

This repository should be an ongoing synchronization source for the HRMS legal database.

18. Wage Orders are a separate database

This is extremely important.

Do not hard-code Philippine minimum wage into the HRMS.

Minimum wage is regional and can change.

The NWPC currently publishes wage orders by region, including separate domestic-worker rates. For example, the current NWPC database shows different wage orders for NCR, CAR, CALABARZON, MIMAROPA and other regions, with effective dates and sometimes multiple wage phases.

National Wages and Productivity Commission — Official Wage Database

The HRMS should therefore have:

WageOrder
    id
    region
    wage_category
    sector
    amount
    effective_from
    effective_to
    location
    establishment_size
    industry
    worker_category
    source_document
    status

Then:

Employee
   ↓
Work Location
   ↓
Region
   ↓
Applicable Wage Order
   ↓
Effective Date
   ↓
Minimum Wage

This is far safer than:

const minimumWage = 610;
19. SSS legal engine

SSS needs its own versioned rules.

The HRMS needs:

SSS Coverage
SSS Registration
SSS Contributions
SSS Salary Credit
SSS EC
Sickness
Maternity
Disability
Retirement
Death
Funeral
Unemployment
Loans
Employer Liability

SSS itself requires employers to register, report employees, deduct employee contributions, remit employee + employer contributions and maintain employment/payroll records.

SSS currently publishes its contribution tables and circulars online, including 2026 circulars.

SSS Employer Portal / Requirements

SSS Contribution Tables

SSS Benefits

20. PhilHealth

The HRMS needs:

PhilHealth PIN
Employer Number
Employee Membership
Dependent Records
Premium Computation
Employer Share
Employee Share
Remittance
Benefits
Claims
YAKAP

PhilHealth explicitly includes private employees, government employees, project-based contractors and other workers within its formal economy categories.

PhilHealth Formal Economy Members

21. Pag-IBIG

The legal engine should include:

Pag-IBIG Membership
Employee Contribution
Employer Contribution
Fund Salary
MPL
Calamity Loan
Housing Loan
MP2
Provident Benefits
Death Claims
Retirement/Withdrawal

And again, these should be effective-dated rules.

22. ECC / Employees' Compensation

Do not combine ordinary SSS sickness with occupational injury.

The HRMS should distinguish:

ORDINARY ILLNESS
        vs
WORK-RELATED ILLNESS
        vs
WORK ACCIDENT

SSS administers ECP for covered private-sector workers, while GSIS administers the government side. ECP includes TTD, disability, medical reimbursement, death and funeral benefits.

The Labor Code's Employees' Compensation framework also establishes compulsory coverage and employer-funded contributions.

23. BIR payroll engine

This should be a completely separate legal module:

Taxable Compensation
Non-Taxable Compensation
Mandatory Contributions
De Minimis Benefits
13th Month
Other Benefits
Withholding Tax
Year-End Adjustment
BIR Form 1601-C
BIR Form 2316
Previous Employer
Tax Annualization

Do not build payroll tax as a simple:

salary × tax_rate

It needs:

Employee
 ↓
Compensation Components
 ↓
Taxability Classification
 ↓
Mandatory Contributions
 ↓
Withholding Rules
 ↓
Cumulative Compensation
 ↓
Tax Table
 ↓
Year-End Adjustment
 ↓
BIR Reporting
24. Government employees need a different legal engine

The HRMS must determine:

PRIVATE
    OR
GOVERNMENT

before applying labor rules.

Government employees involve:

CSC
GSIS
DBM
COA
applicable agency rules
special laws
government leave rules.

The CSC is actively issuing 2026 rules; for example, its current 2026 repository includes Wellness Leave, flexible work arrangements, HIV workplace policy, discrimination guidance and other HR issuances.

Civil Service Commission — 2026 Issuances

25. GSIS

Government employees need:

GSIS Membership
Contributions
Life Insurance
Retirement
Separation
Disability
Unemployment
Survivorship
Funeral
Employees' Compensation

GSIS maintains its own statutory framework and benefit rules.

GSIS Official Website

26. NLRC and labor disputes

The HRMS shouldn't just manage HR transactions.

It should eventually manage:

Employee Complaint
      ↓
Internal Grievance
      ↓
HR Investigation
      ↓
Administrative Case
      ↓
SEnA
      ↓
Labor Arbiter
      ↓
NLRC
      ↓
Appeal / Execution

The NLRC currently states that its proceedings are governed by the Labor Code, the 2025 NLRC Rules of Procedure, and suppletorily by the Rules of Court.

The NLRC also has an official e-Library containing the Labor Code, 2025 NLRC Rules and 2026 Sheriffs' Manual.

NLRC E-Library

27. Professional licenses

For an enterprise HRMS, employees may have:

PRC License
License Number
Profession
Board
Issue Date
Expiry Date
Status
CPD
Verification

This is important for:

engineers
architects
accountants
nurses
teachers
doctors
electricians
electronics engineers
other regulated professions.

PRC maintains official license verification and professional-board information.

Professional Regulation Commission

28. TESDA

For technical occupations:

Employee
 ↓
Qualification
 ↓
NC / Certificate
 ↓
Competency
 ↓
Assessment
 ↓
Expiry / Renewal

This becomes especially important under OSH rules because certain critical occupations may require competency assessment/certification. RA 11058 expressly assigns competency standards/certification roles to TESDA or PRC depending on the occupation.

29. Data Privacy must be built into the HRMS

The HRMS will contain extremely sensitive information:

Birth data
Government IDs
Tax information
Bank accounts
Salary
Medical information
Leave records
Disciplinary records
Family information
SSS
PhilHealth
Pag-IBIG
GSIS
Employment history
Performance

Therefore:

RA 10173 — Data Privacy Act

must be part of the architecture.

Your system should implement:

Data Classification
        ↓
Purpose Limitation
        ↓
Access Control
        ↓
Least Privilege
        ↓
Encryption
        ↓
Audit Logs
        ↓
Retention
        ↓
Deletion/Disposition
        ↓
Data Subject Rights

And HR administrators should not automatically see everything.

30. The HRMS legal database should look like this

I strongly recommend a database structure similar to:

legal_sources
---------------
id
source_type
title
identifier
issuing_authority
jurisdiction
official_url
publication_date
effective_date
repeal_date
status
version
checksum
created_at
updated_at

Example:

{
  "source_type": "DOLE_DEPARTMENT_ORDER",
  "identifier": "DO-174-17",
  "title": "Rules Implementing Articles 106 to 109",
  "issuing_authority": "DOLE",
  "effective_date": "2017-09-07",
  "status": "ACTIVE",
  "official_url": "...",
  "version": 1
}
31. Then create legal provisions
legal_provisions
----------------
id
legal_source_id
book
title
chapter
article
section
paragraph
subject
rule_type
text_reference
effective_from
effective_to
status

For example:

Labor Code
    Book III
        Conditions of Employment
            Working Hours
                Article 83
32. Then create executable rules

This is the most important part.

Do not put legal logic inside random React components.

Instead:

legal_rules
-----------

id
rule_code
legal_source_id
rule_type
jurisdiction
employee_category
industry
location
condition
calculation
effective_from
effective_to
priority
status

Example:

RULE:
PH-OT-DAILY-001

WHEN:
employee is covered
AND work exceeds normal daily hours

THEN:
calculate overtime according to applicable Labor Code
and current implementing rules

Another:

RULE:
PH-MINWAGE-REGION-001

WHEN:
employee.location = Laguna
AND employment_date >= wage_order.effective_date

THEN:
minimum_wage = applicable NWPC wage order
33. Legal source precedence

The HRMS should calculate using:

1. Current applicable law
2. Current IRR
3. Current DOLE/agency issuance
4. Applicable wage order
5. CBA
6. Employment contract
7. Company policy

But with a critical rule:

A lower-level document cannot reduce a statutory minimum unless the law itself permits an exception.

34. Every calculation should explain itself

This is extremely important for enterprise HRMS.

If payroll says:

Overtime Pay = ₱1,245.60

the HRMS should allow HR to click:

"Why?"

and show:

Calculation Explanation

Employee:
Juan Dela Cruz

Basic Rate:
₱25,000/month

Applicable Wage Rule:
Regional Wage Order XXXXX

Work Date:
October 3, 2026

Regular Hours:
8.00

Actual Hours:
10.00

Overtime:
2.00 hours

Applicable Multiplier:
[rule]

Calculated OT:
₱1,245.60

Legal Sources:
Labor Code — Book III
Applicable DOLE implementing rule
Applicable wage order

Rule Version:
2026-XX

That is how we make the HRMS auditable.

35. Government source registry

I would put these into the system as official sources:

Core labor

Department of Labor and Employment

DOLE Bureau of Working Conditions

National Wages and Productivity Commission

Bureau of Local Employment

Occupational Safety and Health Center

Labor dispute / relations

National Labor Relations Commission

National Conciliation and Mediation Board

Social protection

Social Security System

PhilHealth

Pag-IBIG Fund

Employees' Compensation Commission

Government Service Insurance System

Government HR

Civil Service Commission

Department of Budget and Management

Tax

Bureau of Internal Revenue

Skills / professional regulation

TESDA

Professional Regulation Commission

Privacy

National Privacy Commission

Primary legal text

Lawphil — Philippine Laws and Jurisprudence

36. The HRMS should also maintain jurisprudence

This is something many HR systems miss.

A labor-law engine cannot rely exclusively on statutes.

The Supreme Court interprets:

employer-employee relationship
regularization
probationary employment
project employment
fixed-term employment
termination
abandonment
redundancy
retrenchment
labor-only contracting
legitimate subcontracting
management prerogative
wage claims
overtime
retirement
discrimination
due process.

Therefore:

LAW
 +
IRR
 +
DOLE ISSUANCE
 +
WAGE ORDER
 +
SUPREME COURT JURISPRUDENCE
 =
LEGAL KNOWLEDGE

The NLRC e-Library is also useful because it maintains the Labor Code, current procedural rules and other labor materials.

37. The legal knowledge architecture I recommend

Ultimately:

                   HRMS
                    │
          ┌─────────┴─────────┐
          │                   │
    HR BUSINESS LOGIC    LEGAL ENGINE
                              │
             ┌────────────────┼────────────────┐
             │                │                │
          LABOR CODE       DOLE RULES       AGENCY RULES
             │                │                │
        RA / PD / EO      DO / LA / MC     SSS / BIR / etc.
             │                │                │
             └────────────────┼────────────────┘
                              │
                       WAGE ORDERS
                              │
                           CBA
                              │
                    EMPLOYMENT CONTRACT
                              │
                       COMPANY POLICY

And then:

LEGAL ENGINE
     ↓
Eligibility Engine
     ↓
Calculation Engine
     ↓
Compliance Engine
     ↓
Workflow Engine
     ↓
Document Engine
     ↓
Audit Engine
38. One extremely important rule for our development

I do not recommend putting the entire text of every Philippine law into TypeScript files.

For example, don't do this:

if (employee.isRegular && employee.salary < 610) {
   ...
}

Instead:

const rule = legalRules.resolve({
    jurisdiction: "PH",
    location: employee.workLocation,
    employeeType: employee.employmentType,
    industry: employee.industry,
    effectiveDate: payrollDate,
    ruleType: "MINIMUM_WAGE"
});

Then the legal database supplies the applicable rule.

That allows us to update:

2026 Wage Order
      ↓
2027 Wage Order
      ↓
2028 Wage Order

without rewriting payroll.

The scope I recommend for your HRMS

We should ultimately create a Philippine HRMS Legal Knowledge Base v1 with these major libraries:

01 Labor Code
02 DOLE Department Orders
03 DOLE Labor Advisories
04 DOLE Memoranda/Circulars
05 NWPC Wage Orders
06 Statutory Monetary Benefits
07 Working Hours & Attendance
08 Payroll & Wage Rules
09 Leave Rules
10 Termination & Separation
11 Retirement
12 Occupational Safety & Health
13 Construction OSH
14 Contractor/Subcontractor — DO 174
15 Labor Relations
16 Recruitment
17 Foreign Workers
18 Domestic Workers
19 Apprentices/Learners
20 Women Workers
21 Maternity
22 Paternity
23 Solo Parents
24 VAWC
25 Anti-Sexual Harassment
26 Safe Spaces
27 Anti-Discrimination
28 Telecommuting
29 SSS
30 PhilHealth
31 Pag-IBIG
32 ECC
33 BIR
34 GSIS
35 CSC
36 DBM
37 TESDA
38 PRC
39 Data Privacy
40 NLRC Rules
41 NCMB/SEnA
42 Supreme Court Labor Jurisprudence
43 Company Policies
44 CBA
45 Employment Contracts
46 Contractor Compliance
47 Government Employee Rules
48 Special Industry Rules

This is the right foundation for the enterprise HRMS you are building.

And one particularly important current finding: DOLE's own materials already distinguish legitimate contracting/subcontracting, labor standards compliance, OSH compliance, and contractor registration, while the 2026 CSRS makes contractor verification something we can model as an actual digital compliance workflow rather than merely storing a PDF.

I would make this Legal Knowledge Base a foundational module before we build the final payroll/benefits engine. It will prevent the common HRMS problem where a developer hard-codes a 2024/2025 rule and the system becomes legally wrong when a new wage order, DOLE order, SSS circular, or tax rule takes effect.

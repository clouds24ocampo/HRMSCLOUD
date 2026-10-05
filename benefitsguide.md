Yes. I treated this as a Philippine HRMS/payroll specification, not just a general benefits list.

I also checked current official sources because several figures and programs have changed recently. In particular, SSS contribution rules, GSIS benefits, PhilHealth rates, Pag-IBIG contribution ceilings, and government employee benefits need to be kept versioned in an HRMS.

There is one important limitation to the phrase “100% accurate”: government agencies can issue new circulars, wage orders, contribution tables, and annual government incentives. So the correct architecture is to make every rule effective-date/version controlled. The rules below are the current rules I could verify as of October 4, 2026.

PHILIPPINE HRMS — STATUTORY BENEFITS MASTER GUIDE

I will separate this into:

Private-sector employees
Government employees
SSS
PhilHealth
Pag-IBIG
GSIS
Government leave and compensation
How benefits are claimed
Payroll deductions
What our HRMS must calculate
PART I — PRIVATE SECTOR

For a normal private-sector employee, the main statutory systems are:

PRIVATE EMPLOYEE
       │
       ├── SSS
       ├── PhilHealth
       ├── Pag-IBIG
       ├── BIR
       ├── DOLE statutory benefits
       └── ECP

Unlike government employees, a normal private employee generally does not contribute to GSIS.

1. SSS — PRIVATE SECTOR

SSS currently provides these principal benefits:

SSS Benefit	Type
Sickness	Cash
Maternity	Cash
Disability	Cash
Retirement	Pension/lump sum
Death	Pension/lump sum
Funeral	Cash
Unemployment	Cash
Employees' Compensation	Work-related benefits
MySSS Pension Booster / MPF	Retirement/disability/death component

SSS itself lists sickness, maternity, disability, retirement, death, funeral and unemployment as its principal member benefits.

2. SSS CONTRIBUTION — 2026

For employed members:

Regular SSS contribution

15% of Monthly Salary Credit (MSC)

Employee:

5%

Employer:

10%

Current maximum MSC:

₱35,000

effective January 1, 2025.

There is also the Mandatory Provident Fund (MPF/MySSS Pension Booster) for MSC above ₱20,000 up to ₱35,000. The current SSS table must therefore be used instead of simply calculating 15% of salary for every employee.

HRMS

Do this:

Actual Compensation
       ↓
SSS MSC Bracket
       ↓
Current SSS Contribution Table
       ↓
Employee SSS Deduction
+
Employer SSS Cost
+
Employer ECP
+
MPF where applicable

Do not code:

salary × 5%

as the entire employee contribution.

3. SSS SICKNESS BENEFIT
Eligibility

Generally:

sickness/injury prevents employee from working;
incapacity is at least 4 days;
at least 3 monthly contributions within the 12-month period immediately preceding the semester of sickness;
employee has notified employer;
employed member generally must have exhausted current company sick leave with pay.
Formula
6 highest MSC
÷ 180
= ADSC

Then:

ADSC × 90%
= Daily SSS sickness allowance

Then:

Daily allowance × approved compensable days
= SSS sickness benefit

SSS limits sickness benefit to 120 days in one calendar year and generally not more than 240 days for the same illness before it becomes a disability matter.

Claim

For employed workers:

Employee
 ↓
Notify Employer
 ↓
Medical documents
 ↓
Employer submits notification to SSS through My.SSS
 ↓
SSS approval
 ↓
Employer advances benefit where applicable
 ↓
Employer claims reimbursement

SSS now requires employers to process the sickness notification/reimbursement online through My.SSS.

4. SSS MATERNITY
Live childbirth

105 days

Qualified solo parent

120 days

because of the additional 15 days.

Miscarriage / ETP / stillbirth

60 days

SSS maternity benefit is:

ADSC × applicable compensable days

where:

ADSC =
6 highest MSC ÷ 180

SSS states that the daily maternity allowance is 100% of ADSC.

Important employer rule

An employed woman receives:

SSS maternity benefit
+
applicable employer salary differential
=
full pay

subject to the statutory exceptions/exemptions.

Claim process
Employee
 ↓
Notify employer
 ↓
Maternity notification
 ↓
My.SSS
 ↓
Employer MBRA
 ↓
SSS reimbursement

SSS says maternity applications/reimbursements are filed online through My.SSS.

5. SSS DISABILITY

SSS provides:

permanent partial disability;
permanent total disability.

A qualified member can receive either:

Monthly pension

or

Lump sum

depending on contribution and disability circumstances.

For monthly pension eligibility, SSS generally requires at least 36 monthly contributions before the semester of disability.

The exact pension calculation depends on the member's contribution history, MSC and credited years of service, so the HRMS should retrieve the applicable SSS formula rather than calculate it from current salary alone.

6. SSS RETIREMENT

A member generally qualifies for a monthly retirement pension with:

120 monthly contributions

and the applicable retirement age/separation requirements.

SSS states that:

monthly pension = lifetime benefit;
if 120 contributions are not met, lump-sum benefit may apply.
Claim

Qualified members generally file online through:

My.SSS

with an enrolled disbursement account/UMID-ATM arrangement as applicable.

7. SSS DEATH BENEFIT

When a qualified member dies:

Primary beneficiaries

May receive:

monthly survivorship pension; or
lump sum, depending on qualification.

SSS provides death benefits for qualified beneficiaries.

Claim

Can be filed at SSS branches, with certain qualified dependent spouses able to file online through My.SSS.

8. SSS FUNERAL BENEFIT

Current benefit:

At least 36 contributions

Variable:

₱20,000–₱60,000

1–35 contributions

₱12,000

SSS confirms these amounts effective October 20, 2023.

Claim

The person who paid the funeral expenses may claim.

Online:

My.SSS
 ↓
Benefits
 ↓
Funeral Claim
 ↓
Upload death/funeral documents
 ↓
SSS approval

Non-SSS member claimants generally file over the counter.

9. SSS UNEMPLOYMENT BENEFIT

For qualified involuntarily separated covered employees:

50% of Average Monthly Salary Credit

for up to:

2 months

subject to the contribution and separation requirements.

Claim:

My.SSS → Unemployment Benefit

SSS requires an eligible involuntary separation and the required contribution history.

10. EMPLOYEES' COMPENSATION PROGRAM — ECP

ECP covers work-related:

sickness;
injury;
disability;
death.

For private-sector employees covered by SSS, ECP coverage starts from the first day of employment.

Benefits include:

temporary total disability;
permanent disability;
medical reimbursement;
rehabilitation;
death;
funeral;
carer's allowance.

The employer pays the ECP contribution.

PART II — PHILHEALTH

This applies to both:

PRIVATE + GOVERNMENT

Government employees and private employees are both classified within PhilHealth's formal economy coverage.

11. PHILHEALTH CONTRIBUTION

Current verified framework:

5%

of Monthly Basic Salary.

Minimum contribution base:

₱10,000

Maximum:

₱100,000

Therefore:

Minimum
₱10,000 × 5%
= ₱500
Maximum
₱100,000 × 5%
= ₱5,000

The premium is generally divided:

Employee = 50%
Employer = 50%

Therefore maximum employee share:

₱2,500

Maximum employer share:

₱2,500

PhilHealth's official advisory confirms the 5% rate and ₱10,000/₱100,000 floor and ceiling.

What is Monthly Basic Salary?

PhilHealth says it excludes:

overtime;
allowances;
13th-month pay;
bonuses;
gratuities;
similar payments.

It also excludes deductions resulting from undertime, tardiness, leave without pay and absences when determining the MBS.

12. PHILHEALTH BENEFITS

PhilHealth is primarily a health-care benefit system, not a cash salary-replacement system.

Major benefit categories include:

Inpatient
hospitalization;
medical conditions;
surgical procedures;
case rates;
professional fees;
hospital charges.
Outpatient
day surgery;
radiotherapy;
outpatient procedures;
primary care;
medicines;
diagnostics;
specialized packages.

PhilHealth's benefit system currently includes All Case Rates and numerous specialized packages.

Other important programs/packages include:

YAKAP primary care;
GAMOT/outpatient medicines;
cancer-related packages;
dialysis;
maternity;
mental health;
HIV/AIDS;
TB;
malaria;
animal bite;
family planning;
rehabilitation;
selected outpatient services.

PhilHealth maintains the current package list and accredited facilities.

How to claim

Usually:

Patient
 ↓
PhilHealth-accredited facility
 ↓
Member eligibility verified
 ↓
Facility processes PhilHealth claim
 ↓
PhilHealth pays accredited facility
 ↓
PhilHealth benefit deducted from bill

The member generally does not receive the case-rate amount as cash.

PhilHealth explicitly says case-rate amounts are deducted by the accredited facility from the member's bill before discharge.

PART III — PAG-IBIG

Pag-IBIG applies to both private and government employees who are covered members.

13. PAG-IBIG MONTHLY SAVINGS

Effective February 2024, the Maximum Fund Salary became:

₱10,000

The contribution structure is:

Fund Salary	Employee	Employer
₱1,500 and below	1%	2%
Above ₱1,500	2%	2%
Maximum base	₱10,000	₱10,000

Therefore the ordinary maximum contribution is:

Employee: ₱200

Employer: ₱200

The MFS increase to ₱10,000 was implemented through Pag-IBIG Circular No. 460 and corresponding DBM guidance for government agencies.

14. PAG-IBIG PROVIDENT BENEFIT

The member accumulates:

Employee savings
+
Employer counterpart
+
Dividends
=
Total Accumulated Value (TAV)

The member may claim the TAV under qualifying grounds including:

membership maturity;
retirement;
permanent total disability/insanity;
termination due to health;
qualifying critical illness;
death;
optional withdrawal;
permanent departure from country;
other approved grounds.

Membership maturity

Generally:

20 years membership + 240 monthly savings

Optional withdrawal

Generally:

15 years / 180 monthly savings

subject to Pag-IBIG rules and the one-time optional withdrawal provision.

Claim

Many provident claims can be filed through:

Virtual Pag-IBIG

or at a Pag-IBIG branch, depending on the claim type.

15. PAG-IBIG MULTI-PURPOSE LOAN

Generally requires:

24 monthly membership savings

and at least one membership saving within the preceding six months, subject to the other eligibility rules.

Loan entitlement is generally:

up to 80% of TAV, subject to capacity-to-pay and other rules.

The current MPL application form provides a 10.5% p.a. nominal interest rate, equivalent to a 17.5% effective rate based on diminishing principal, with 2- or 3-year terms.

The HRMS should not calculate the loan as a statutory deduction unless the employee has an active Pag-IBIG loan and the employer has the applicable salary-deduction authority.

16. PAG-IBIG CALAMITY LOAN

Generally requires:

24 monthly savings;
at least one savings within the preceding six months;
member/location/workplace affected by declared calamity;
account not in default;
proof of income.

Loan entitlement:

up to 80% of TAV, subject to existing loan balances and capacity to pay.

Current Pag-IBIG application materials state:

5.95% p.a. interest

and generally:

2 or 3 years

with a grace period under the current guidelines.

The loan must generally be availed within 90 days from declaration of the calamity.

17. PAG-IBIG HOUSING LOAN

Pag-IBIG also provides long-term housing financing, including financing for:

purchase of residential property;
construction;
home improvement;
refinancing;
related housing purposes.

This is not a payroll benefit paid in cash. It is a financing facility.

The HRMS should therefore treat:

Pag-IBIG Housing Loan
=
Employee Loan Deduction

not:

Statutory Contribution
PART IV — GOVERNMENT EMPLOYEES

Now we move to a fundamentally different system.

For a typical permanent civilian government employee, the primary social insurance system is:

GSIS

not SSS.

However:

PhilHealth + Pag-IBIG still apply.

Government employees are also subject to:

Civil Service leave rules;
government compensation rules;
DBM rules;
General Appropriations Act;
GSIS;
PhilHealth;
Pag-IBIG;
BIR.
18. GOVERNMENT PAYROLL STRUCTURE

Typical permanent government employee:

Government Employee
       │
       ├── GSIS
       ├── PhilHealth
       ├── Pag-IBIG
       ├── BIR
       ├── Civil Service Leave
       ├── Year-End Bonus
       ├── Mid-Year Bonus
       ├── Cash Gift
       ├── Other authorized incentives
       └── Retirement / Terminal Leave
19. GSIS CONTRIBUTION

Current GSIS contribution:

Employee

9%

Government agency

12%

of the employee's actual monthly salary.

GSIS confirms the 9% employee / 12% government share under RA 8291.

Example

Government employee salary:

₱30,000

Employee:

₱30,000 × 9%
= ₱2,700

Government:

₱30,000 × 12%
= ₱3,600

Total:

₱6,300

Unlike SSS, the HRMS should not apply the private-sector SSS table to a GSIS-covered employee.

20. GSIS RETIREMENT

Under RA 8291, one retirement route requires:

At least 15 years of service

and:

at least 60 years old

and separation from service.

GSIS provides two principal retirement options:

Option 1

5-year lump sum + old-age pension

The lump sum is:

60 × Basic Monthly Pension

After five years, lifetime pension begins.

Option 2

18 × Basic Monthly Pension

plus immediate lifetime pension.

GSIS confirms these two options.

Basic Monthly Pension

For 15+ years:

BMP =
0.375 × RAMC

or:

0.025 × RAMC × Period with Paid Premiums

subject to the applicable statutory cap.

GSIS defines:

RAMC = ₱700 + Average Monthly Compensation

and the BMP cannot exceed 90% of AMC.

This must be implemented as a GSIS-specific calculation engine.

21. GSIS DISABILITY

GSIS provides disability benefits for non-work-related disability under RA 8291 and work-related disability through the Employees' Compensation system.

Current GSIS information states that RA 8291 disability pensioners may receive:

lifetime basic monthly pension;
minimum ₱5,000 basic monthly pension;
Christmas cash gift;
annual pension increase subject to GSIS Board approval;
milestone benefit;
funeral benefit;
survivorship benefit.

22. GSIS UNEMPLOYMENT

This is different from SSS unemployment.

Qualified permanent government employees who are involuntarily separated because of:

abolition of position;
reorganization;
merger;
privatization,

may qualify.

Benefit:

50% of Average Monthly Compensation

Duration:

Contributions/service	Benefit
1–<3 years	2 months
3–<6 years	3 months
6–<9 years	4 months
9–<11 years	5 months
11–<15 years	6 months

GSIS states that the claim must be filed within four years and that the unemployment benefit is deducted from future separation/retirement benefits.

23. GSIS SURVIVORSHIP

Upon death of a qualified GSIS member/pensioner:

Legal spouse

Generally:

50% of deceased member's pension

subject to statutory limitations.

Dependent children

Generally:

10% each

with a maximum of five dependent pensioners under the applicable GSIS rules.

GSIS confirms these survivorship rules.

24. GSIS FUNERAL BENEFIT

This has recently changed, which is exactly why our HRMS must version government rules.

Effective July 13, 2026:

Standard eligible GSIS funeral benefit

₱50,000

GSIS increased it from ₱30,000.

For PNP, BJMP and BFP uniformed members:

₱10,000

under the current GSIS rule cited.

This is a perfect example of why we should not hard-code "₱30,000" into the HRMS.

25. GSIS LIFE INSURANCE

Government employees covered by GSIS have government life insurance.

There are two principal policy types:

Enhanced Life Policy — ELP

Generally applies to employees entering government service after July 31, 2003.

Life Endowment Policy — LEP

Generally applies to employees who entered government service before August 1, 2003, subject to the applicable rules.

GSIS confirms these policy classifications.

Benefits depend upon the policy, membership status and contingency.

The HRMS should therefore store:

GSIS Life Insurance
├── Policy Type
├── Coverage
├── Effective Date
├── Beneficiaries
└── Claim Status
26. GOVERNMENT EMPLOYEE VACATION LEAVE

A typical covered government employee earns:

15 days Vacation Leave/year

and:

15 days Sick Leave/year

The CSC's leave system recognizes Vacation Leave and Sick Leave as distinct credits.

The monthly accrual is commonly:

1.25 VL/month

1.25 SL/month

for a total:

2.5 leave credits/month

This is fundamentally different from the private-sector statutory 5-day SIL.

27. GOVERNMENT SICK LEAVE

Typical entitlement:

15 days/year

subject to the Civil Service leave rules.

Unlike private-sector SIL, government employees accumulate VL/SL credits under the Civil Service system.

28. GOVERNMENT SPECIAL PRIVILEGE LEAVE

Government employees can have:

3 days Special Privilege Leave/year

subject to the CSC rules and qualifying circumstances.

The official CSC Application for Leave specifically recognizes Special Privilege Leave.

29. MANDATORY/FORCED LEAVE

Government employees with sufficient vacation leave credits are subject to the mandatory/forced leave rules.

Generally:

5 days

must be scheduled/used under the applicable Civil Service rules, subject to exceptions and agency procedures.

The CSC leave form specifically identifies Mandatory/Forced Leave.

30. GOVERNMENT MATERNITY LEAVE

Government employees receive:

105 days full pay

for live childbirth.

Solo parents receive:

additional 15 days

for a total:

120 days

Miscarriage/ETP:

60 days full pay

There is also:

30 days optional extension without pay

or use of available sick leave credits for extension with pay under the applicable rules.

31. GOVERNMENT PATERNITY LEAVE

Qualified government male employees generally receive:

7 days with full pay

under RA 8187 and CSC rules.

The mother may also allocate up to 7 days of maternity leave to the child's father or qualified alternate caregiver.

This allocation is separate from the father's own 7-day paternity leave.

32. GOVERNMENT ADOPTION LEAVE

Qualified adoptive parents may receive:

60 days adoption leave with full pay

under the applicable CSC rules.

The qualified male spouse may also receive the applicable paternity leave.

33. SOLO PARENT LEAVE — GOVERNMENT

Qualified solo-parent employees are covered by the applicable solo-parent leave rules.

The CSC leave system specifically includes Solo Parent Leave under RA 8972.

Current expanded solo-parent rules under RA 11861 should be encoded with eligibility and documentary requirements rather than treating it as an unconditional leave balance.

34. VAWC LEAVE

Qualified female employees under RA 9262:

10 days paid leave

The CSC leave system explicitly includes the 10-Day VAWC Leave.

35. SPECIAL LEAVE FOR WOMEN

Qualified female government employees who undergo surgery due to gynecological disorders may receive the statutory special leave under RA 9710 and CSC rules.

The CSC recognizes this benefit in its leave system.

36. STUDY LEAVE

Government employees may qualify for Study Leave under the Civil Service rules, subject to eligibility, agency approval and applicable conditions.

The CSC leave form expressly provides Study Leave for purposes including:

Master's degree completion;
BAR/board examination review;
other approved purposes.

The exact duration and conditions should therefore be stored as a leave policy, rather than hard-coded as a universal number.

37. REHABILITATION PRIVILEGE

Government employees may qualify for Rehabilitation Privilege under the Civil Service leave rules.

This covers recovery/rehabilitation circumstances under the applicable CSC rules.

The official CSC leave form recognizes Rehabilitation Privilege.

38. SPECIAL EMERGENCY/CALAMITY LEAVE

The Civil Service system also provides:

Special Emergency (Calamity) Leave

under applicable CSC rules.

The official government leave form identifies this category.

39. WELLNESS LEAVE — GOVERNMENT

This is a new 2026 government benefit/policy that we absolutely need to account for.

CSC Memorandum Circular No. 01, s. 2026 authorizes agencies to grant:

up to 5 days Wellness Leave

for government officials/employees within its coverage.

It is:

separate from VL;
separate from SL;
separate from Special Privilege Leave.

The agency has discretion to grant it subject to the CSC policy.

This is another example where an HRMS must distinguish:

Statutory entitlement
vs
CSC-authorized agency benefit
vs
Agency discretionary benefit
40. GOVERNMENT MID-YEAR BONUS

Qualified government personnel receive:

1 month basic salary

subject to the applicable DBM conditions.

The standard requirements include:

required period of service;
still in service on the applicable date;
satisfactory performance rating;
other DBM requirements.

DBM rules provide the one-month basic salary structure.

This is not an SSS/GSIS/Pag-IBIG benefit.

It is a government compensation benefit.

41. GOVERNMENT YEAR-END BONUS

Qualified government personnel receive:

1 month basic salary

plus:

₱5,000 Cash Gift

subject to the applicable service requirements.

DBM's current 2026 General Provisions confirm the one-month year-end bonus and ₱5,000 cash gift.

42. GOVERNMENT PEI

The Productivity Enhancement Incentive (PEI) is generally:

₱5,000

for qualified government personnel when authorized for the applicable fiscal year.

For FY2025, DBM authorized:

₱5,000

for qualified personnel.

Important: We should NOT classify PEI as a permanent guaranteed annual benefit in the database without an annual authorization record.

43. SERVICE RECOGNITION INCENTIVE

SRI is similarly an annual/one-time government incentive when specifically authorized.

For FY2025, Administrative Order No. 40 authorized an SRI of not exceeding ₱20,000 for qualified government personnel.

Do not hard-code:

Government SRI = ₱20,000 every year

Instead:

government_incentive_rules
year = 2025
type = SRI
maximum = 20,000
authority = AO 40
44. GOVERNMENT TERMINAL LEAVE

When a government employee separates/retirements under circumstances covered by the Civil Service rules, accumulated leave credits can become payable as Terminal Leave Benefit.

The computation is based on the applicable government terminal-leave rules and the employee's accumulated leave credits and salary.

DBM recognizes terminal leave as a government personnel expenditure subject to applicable laws and rules.

The HRMS should therefore maintain:

VL Balance
SL Balance
Other Convertible Leave
Terminal Leave Eligibility
Terminal Leave Rate
Terminal Leave Payable
45. GOVERNMENT RETIREMENT

There are several retirement laws/modes, but the major current GSIS route for covered employees is:

RA 8291

with the retirement conditions and options described above.

There are also historical/special retirement laws such as:

RA 660;
PD 1146;
RA 1616;

subject to the employee's historical service and applicable eligibility.

Therefore:

Do not create one universal "Government Retirement Formula."

The HRMS must determine the applicable retirement law/mode.

GSIS and DBM continue to maintain rules for different retirement categories.

PART V — PRIVATE vs GOVERNMENT

Here is the clean comparison you should use in the HRMS.

Benefit/System	Private	Government
SSS	Yes	Normally No for GSIS-covered personnel
GSIS	Normally No	Yes
PhilHealth	Yes	Yes
Pag-IBIG	Yes	Yes
BIR	Yes	Yes
ECP	Yes	Government EC system/GSIS framework
13th Month	Yes	Different government bonus system
5-day SIL	Yes, subject to coverage	Not the normal government leave system
Vacation Leave	Company policy/statutory where applicable	15 days/year typical Civil Service entitlement
Sick Leave	Company/statutory rules	15 days/year typical Civil Service entitlement
Special Privilege Leave	Not general statutory private benefit	3 days
Maternity	105/120/60	105/120/60
Paternity	7 days	7 days
Adoption	Applicable law	60 days under CSC rules
VAWC	10 days	10 days
Solo Parent	Applicable law	Applicable law/CSC
Wellness Leave	Not universal statutory private benefit	Up to 5 days, agency discretion under 2026 CSC policy
Mid-Year Bonus	No universal statutory equivalent	1 month basic salary, subject to DBM rules
Year-End Bonus	No universal equivalent	1 month basic + ₱5,000 cash gift, subject to rules
PEI	No	Annual authorization
SRI	No	Annual authorization
GSIS retirement	No	Yes
SSS retirement	Yes	Normally no for GSIS-covered employee
Pag-IBIG TAV	Yes	Yes
PART VI — CONTRIBUTION CALCULATION

This is the most important part for your payroll engine.

PRIVATE EMPLOYEE

Suppose:

Basic salary = ₱30,000

The payroll engine calculates:

SSS

Determine applicable:

MSC → SSS contribution table

Do not calculate purely as salary × 5%.

PhilHealth
₱30,000 × 5%
= ₱1,500

Employee:

₱750

Employer:

₱750

Pag-IBIG

Maximum fund salary:

₱10,000

₱10,000 × 2%
= ₱200 employee

Employer:

₱200

BIR

Then:

Gross taxable compensation
        ↓
Less allowable non-taxable compensation
        ↓
Less mandatory employee contributions
        ↓
Taxable compensation
        ↓
BIR withholding table
PART VII — GOVERNMENT EMPLOYEE

Suppose:

Basic salary = ₱30,000

GSIS

Employee:

₱30,000 × 9%
= ₱2,700

Government:

₱30,000 × 12%
= ₱3,600
PhilHealth
₱30,000 × 5%
= ₱1,500

Employee:

₱750

Government:

₱750

Pag-IBIG

Employee:

₱200

Government:

₱200

Therefore employee statutory deductions before BIR and authorized deductions include:

GSIS       ₱2,700
PhilHealth    750
Pag-IBIG      200
-----------------
Subtotal    ₱3,650

Then BIR withholding is separately calculated.

PART VIII — WHAT SHOULD BE A PAYROLL DEDUCTION?

This distinction is extremely important.

Mandatory employee deductions
Private
SSS
PhilHealth
Pag-IBIG
BIR withholding tax
Government
GSIS
PhilHealth
Pag-IBIG
BIR withholding tax
Employer costs

These are not deducted from employee salary:

Private
Employer SSS share
Employer ECP
Employer PhilHealth share
Employer Pag-IBIG share
Government
Government GSIS share
Government PhilHealth share
Government Pag-IBIG share

The employer/government counterpart must never be accidentally deducted from the employee's net salary.

PART IX — HRMS CLAIM ENGINE

I recommend we make a completely separate Benefits Management module.

Benefits
│
├── SSS
│   ├── Sickness
│   ├── Maternity
│   ├── Disability
│   ├── Retirement
│   ├── Death
│   ├── Funeral
│   └── Unemployment
│
├── PhilHealth
│   ├── Inpatient
│   ├── Outpatient
│   ├── Maternity
│   ├── Primary Care
│   ├── Medicines
│   ├── Cancer
│   ├── Dialysis
│   └── Special Packages
│
├── Pag-IBIG
│   ├── Provident
│   ├── MPL
│   ├── Calamity
│   ├── Housing
│   └── MP2
│
└── Government / GSIS
    ├── Retirement
    ├── Separation
    ├── Unemployment
    ├── Disability
    ├── Survivorship
    ├── Funeral
    ├── Life Insurance
    └── EC
PART X — BENEFIT CLAIM WORKFLOW

Every benefit should have:

Employee
   ↓
Eligibility Check
   ↓
Required Documents
   ↓
HR Validation
   ↓
Employer Certification
   ↓
Government Submission
   ↓
Government Assessment
   ↓
Approved / Rejected
   ↓
Payment
   ↓
Payroll Reconciliation
   ↓
Audit Trail

For example, SSS sickness:

Employee submits medical certificate
             ↓
HR validates leave
             ↓
System checks SSS contribution eligibility
             ↓
Employer files SSS notification
             ↓
SSS approval
             ↓
Employer advances benefit
             ↓
Employee confirms receipt
             ↓
Employer requests reimbursement
             ↓
Reimbursement posted

SSS's current online sickness workflow explicitly supports employer submission and reimbursement through My.SSS.

PART XI — THE MOST IMPORTANT HRMS RULE

We should never put these formulas directly into random payroll functions.

Instead, our HRMS should have:

Philippine Statutory Rules Engine

with:

statutory_rules
----------------------------
id
agency
rule_code
benefit_type
employee_sector
formula
parameters
coverage
eligibility
effective_from
effective_to
source_law
source_issuance
version
status

For example:

SSS-2025-EMPLOYEE
Agency: SSS
Sector: Private
Employee: 5%
Employer: 10%
MSC Max: 35,000
Effective: 2025-01-01

Another:

PHIC-2025
Agency: PhilHealth
Rate: 5%
Floor: 10,000
Ceiling: 100,000
Employee Share: 50%
Employer Share: 50%
Effective: 2025-01-01

Another:

GSIS-8291
Employee: 9%
Government: 12%
Basis: Actual Monthly Salary

Another:

HDMF-460
MFS: 10,000
Employee: 1%/2%
Employer: 2%
Effective: 2024-02-01
PART XII — VERY IMPORTANT FOR 2026

I found several examples showing why the HRMS must be date/version driven:

GSIS funeral benefit increased from ₱30,000 to ₱50,000 effective July 13, 2026.
CSC introduced a Wellness Leave policy in 2026, up to 5 days at agency discretion.
SSS uses the contribution schedule effective January 1, 2025, with MSC up to ₱35,000 and MPF above ₱20,000.
Pag-IBIG's Maximum Fund Salary increased to ₱10,000 effective February 2024.
PhilHealth's current verified premium advisory retains 5%, with ₱10,000 floor and ₱100,000 ceiling.
Government annual incentives such as SRI and PEI are authorization/year dependent, not permanent payroll constants.
The architecture I recommend for your HRMS

We should ultimately have two separate statutory profiles:

PRIVATE
Employee
 ↓
Private Payroll Profile
 ↓
SSS
PhilHealth
Pag-IBIG
BIR
DOLE
ECP
GOVERNMENT
Employee
 ↓
Government Payroll Profile
 ↓
GSIS
PhilHealth
Pag-IBIG
BIR
CSC Leave
DBM Compensation
Government EC

And then a common layer:

                EMPLOYEE
                    │
          ┌─────────┴─────────┐
          │                   │
      PRIVATE             GOVERNMENT
          │                   │
       SSS                  GSIS
          │                   │
          └───────┬───────────┘
                  │
          ┌───────┼────────┐
          │       │        │
     PhilHealth Pag-IBIG  BIR
          │       │        │
          └───────┴────────┘
                  │
           BENEFITS ENGINE
                  │
           PAYROLL ENGINE
                  │
           CLAIMS ENGINE
                  │
            AUDIT ENGINE

That is the structure I would use for the enterprise HRMS we are designing.

One final caution: I would not yet call this the final coding specification because there are additional areas we need to lock down separately—particularly the current 2026 SSS contribution table by exact salary bracket, BIR withholding computation for monthly/semi-monthly payroll, all DOLE holiday multipliers, government leave monetization/terminal-leave formulas, GSIS separation/retirement modes, and special categories such as teachers, military/uniformed personnel, JO/COS workers, GOCCs and LGUs. Those have different rules and should not be mixed into the ordinary private/government employee formulas.

For the actual HRMS, the safest next deliverable is a Philippine Statutory Payroll Master Matrix with one row per rule: coverage → eligibility → exact formula → employee deduction → employer share → benefit amount → claim documents → claim process → accounting treatment → legal source → effective date. That becomes our controlled specification before implementing payroll.
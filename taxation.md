Yes. For your HRMS, Philippine employee income tax should be designed as a separate BIR Tax / Withholding Tax Engine, because the system must compute not simply “salary × tax rate,” but taxable compensation after applying exemptions, mandatory contributions, benefits, and the correct payroll-period withholding table.

I researched the current BIR rules and the latest 2026 BIR materials. The important point is that the income-tax rules apply to both private-sector and government employees, although their mandatory deductions differ (SSS vs. GSIS, for example).

1. The Philippine employee income-tax system

For an employee, the employer generally performs withholding tax on compensation.

The basic concept is:

Gross Compensation
− Non-taxable/exempt compensation
− Employee mandatory contributions
= Taxable Compensation

Then the applicable BIR withholding-tax table is used.

BIR's current Form 1601-C specifically separates:

Total compensation
Minimum-wage-earner exemption
Holiday/OT/night differential/hazard pay for MWEs
13th-month pay and other benefits
De minimis benefits
SSS/GSIS
PhilHealth
Pag-IBIG
Union dues
Other non-taxable compensation
Taxable compensation
Net taxable compensation
Tax withheld.
2. Current Philippine individual income-tax brackets

For 2023 onward, including 2026, the graduated income-tax rates are:

Annual taxable income	Income tax
₱250,000 or less	0%
Over ₱250,000 – ₱400,000	15% of excess over ₱250,000
Over ₱400,000 – ₱800,000	₱22,500 + 20% of excess over ₱400,000
Over ₱800,000 – ₱2,000,000	₱102,500 + 25% of excess over ₱800,000
Over ₱2,000,000 – ₱8,000,000	₱402,500 + 30% of excess over ₱2,000,000
Over ₱8,000,000	₱2,202,500 + 35% of excess over ₱8,000,000

These rates are reflected in BIR's current forms and materials.

Important

The employee is not taxed at 35% on the entire salary just because the employee reaches the highest bracket.

The tax is progressive.

For example, if annual taxable income is ₱600,000:

₱22,500 + 20% × (₱600,000 − ₱400,000)

= ₱22,500 + ₱40,000

= ₱62,500 annual income tax

3. The ₱250,000 threshold

An employee whose annual taxable income does not exceed ₱250,000 has zero income tax under the graduated rates.

This does not mean that the employee's gross salary must be ≤ ₱250,000.

You first determine taxable compensation.

For example:

Gross compensation:

₱300,000

Less employee mandatory contributions:

₱30,000

Taxable compensation:

₱270,000

Tax:

15% × ₱20,000

= ₱3,000

So the ₱250,000 threshold applies to taxable income, not simply gross salary. BIR specifically recognizes the ₱250,000 compensation threshold.

4. What is taxable salary?

Your HRMS should classify every payroll earning.

Normally taxable

Examples include:

Basic salary
Taxable allowances
Representation allowance
Transportation allowance
Housing allowance
Commission
Professional/director fees where applicable
Overtime pay for non-MWE employees
Holiday pay for non-MWE employees
Night differential for non-MWE employees
Bonuses, subject to the applicable ₱90,000 rule
Taxable portion of de minimis benefits
Taxable fringe benefits where applicable
Taxable separation/retirement payments
Other taxable compensation

BIR's own withholding-tax calculator identifies basic salary, representation allowance, transportation allowance, COLA, housing allowance, commission, profit sharing, fees, overtime, hazard pay and other taxable compensation as relevant components.

5. Mandatory employee contributions reduce taxable compensation

This is extremely important for your HRMS.

The employee's share of:

SSS
GSIS
PhilHealth
Pag-IBIG/HDMF
qualifying union dues

is deducted when determining taxable compensation.

So the payroll sequence should generally be:

Gross compensation

↓

Less non-taxable compensation

↓

Less employee mandatory contributions

↓

Taxable compensation

↓

BIR withholding tax

↓

Net pay

6. Private employee example

Let's create a simple example.

Employee:

Monthly basic salary = ₱40,000

Assume for illustration:

SSS = ₱2,000
PhilHealth = ₱1,000
Pag-IBIG = ₱200

Employee contributions:

₱3,200

Assume no other benefits.

Step 1 — Gross

₱40,000

Step 2 — Less mandatory contributions

₱40,000 − ₱3,200

= ₱36,800

Step 3 — Annualize

₱36,800 × 12

= ₱441,600

Assuming there are no other taxable/non-taxable adjustments:

Annual taxable compensation ≈ ₱441,600

Step 4 — Apply annual tax table

The employee is in:

₱400,000–₱800,000 bracket

Tax:

₱22,500 + 20% × (₱441,600 − ₱400,000)

= ₱22,500 + ₱8,320

= ₱30,820 annual tax

Approximate average monthly withholding:

₱30,820 ÷ 12

= ₱2,568.33

Important: This is an illustrative computation. A production payroll engine should not simply divide annual tax by 12 in every situation because actual BIR withholding uses the prescribed payroll-period tables and year-end adjustment.

7. BIR withholding tables are different by payroll frequency

This is particularly important for your HRMS because you previously asked about:

daily employees
5-day workweek
6-day workweek
weekly payroll
semi-monthly payroll
monthly payroll.

BIR provides withholding tables for:

Daily

Current table includes:

Daily compensation	Rate
₱685 and below	0%
₱685–₱1,095	15% over ₱685
₱1,096–₱2,191	₱61.65 + 20% over ₱1,096
₱2,192–₱5,478	₱280.85 + 25% over ₱2,192
₱5,479–₱21,917	₱1,102.60 + 30% over ₱5,479
₱21,918+	₱6,034 + 35% over ₱21,918
Weekly
Weekly compensation	Rate
₱4,808 and below	0%
₱4,808–₱7,691	15%
₱7,692–₱15,384	20%
₱15,385–₱38,461	25%
₱38,462–₱153,845	30%
₱153,846+	35%
Semi-monthly
Semi-monthly compensation	Rate
₱10,417 and below	0%
₱10,417–₱16,666	15%
₱16,667–₱33,332	20%
₱33,333–₱83,332	25%
₱83,333–₱333,332	30%
₱333,333+	35%
Monthly
Monthly compensation	Rate
₱20,833 and below	0%
₱20,833–₱33,332	15%
₱33,333–₱66,666	20%
₱66,667–₱166,666	25%
₱166,667–₱666,666	30%
₱666,667+	35%

These are the BIR Annex E withholding thresholds effective January 1, 2023 onward.

8. Very important: Minimum Wage Earners

The tax treatment of an MWE — Minimum Wage Earner is different.

A qualified MWE is exempt from income tax on:

Statutory minimum wage
Holiday pay
Overtime pay
Night shift differential
Hazard pay

The BIR regulations expressly provide this treatment.

However, if the employee receives other taxable compensation such as:

commission
honorarium
taxable allowance
taxable fringe benefit
benefits exceeding statutory limits

the additional taxable compensation can become subject to tax.

So your HRMS should have an employee classification:

Tax Classification
├── Minimum Wage Earner
└── Non-Minimum Wage Earner
9. 13th-month pay

The first ₱90,000 of 13th-month pay and other qualifying benefits is generally excluded from taxable compensation.

Anything exceeding the applicable ₱90,000 ceiling becomes taxable.

For example:

13th-month pay:

₱100,000

Tax-exempt:

₱90,000

Taxable:

₱10,000

BIR's current withholding calculator continues to use the ₱90,000 ceiling.

But there is an important distinction

The ₱90,000 ceiling is not necessarily just the employee's 13th-month pay alone.

It covers the statutory category of 13th-month pay and other benefits subject to the applicable rules.

Your HRMS therefore needs a yearly cumulative tracker.

10. De minimis benefits — important 2026 update

This is an area where your HRMS must not use old hard-coded values.

BIR issued Revenue Regulations No. 29-2025 on December 22, 2025, increasing several de minimis ceilings.

Examples under the updated rules include:

Benefit	Current ceiling
Medical allowance to dependents	₱2,000/semester or ₱333/month
Rice subsidy	₱2,500/month
Uniform/clothing allowance	₱8,000/year
Medical assistance	₱12,000/year
Laundry allowance	₱400/month
Achievement award	₱12,000/year
Christmas/anniversary gifts	₱6,000/year

The regulation also addresses monetized unused vacation leave and government leave monetization.

This is extremely important for your HRMS architecture.

Do not code:

rice_allowance = 1500

permanently.

Instead:

statutory_rule
    agency = BIR
    rule = DE_MINIMIS_RICE_SUBSIDY
    amount = 2500
    effective_from = ...
    effective_to = null

Because BIR can change the ceiling.

11. Private vs government employee

The income-tax brackets are generally the same because the tax is imposed under the National Internal Revenue Code.

The difference is primarily the employee's compensation structure and mandatory deductions.

Private employee

Example:

Gross salary
- SSS
- PhilHealth
- Pag-IBIG
- non-taxable benefits
= taxable compensation
Government employee

Example:

Gross salary
- GSIS
- PhilHealth
- Pag-IBIG
- non-taxable benefits
= taxable compensation

BIR's Form 1601-C expressly accommodates both Private and Government withholding agents.

12. Government bonuses are not automatically tax-free

This is important when we build your government HRMS.

Government employees may receive things such as:

Mid-Year Bonus
Year-End Bonus
Cash Gift
PEI
SRI
CNA incentive
other authorized benefits

But the fact that something is called a government bonus/incentive does not automatically mean it is completely income-tax exempt.

Your HRMS must classify each payment according to the current BIR tax treatment, rather than simply marking government bonuses as "non-taxable."

BIR's calculator specifically includes bonuses and other benefits in the compensation calculation, subject to the applicable exclusions/limits.

13. Year-end adjustment

This is one of the most important parts of a professional payroll system.

Suppose during the year the system withheld:

₱25,000

But after calculating the employee's actual annual taxable compensation, the employee's actual tax liability is:

₱22,000

The employer has over-withheld:

₱3,000

The payroll system must account for the difference through the year-end adjustment/refund mechanism.

Conversely, if actual tax is ₱28,000 and only ₱25,000 has been withheld:

₱3,000 additional withholding is required.

BIR's Form 1601-C contains a specific mechanism for adjustments of taxes withheld from previous months and year-end adjustments.

14. Employee transfers to another employer

This is another HRMS issue that is often missed.

Suppose:

Employee works for Company A:

January–June

Then transfers to Company B:

July–December

The employee's annual tax situation can require the employee to provide the new employer with the previous employer's BIR Form 2316.

BIR requires Form 2316 to document compensation and tax withheld.

Your HRMS should therefore have:

Previous Employment Tax Information
├── Previous Employer
├── Employment Start
├── Employment End
├── Gross Compensation
├── Taxable Compensation
├── Non-Taxable Compensation
├── Tax Withheld
└── BIR Form 2316
15. BIR Form 2316

The employer must issue the employee a:

BIR Form 2316 — Certificate of Compensation Payment/Tax Withheld

It shows the employee's compensation and tax withheld during the year.

BIR states that it is issued generally on or before January 31 of the succeeding year, or upon termination, on the day the last compensation payment is made.

Your HRMS should therefore automatically generate:

Employee
      ↓
Annual Payroll
      ↓
Annual Tax Reconciliation
      ↓
BIR Form 2316
      ↓
Employee / Employer Certification
16. Employer's responsibility

The employer is the withholding agent.

BIR states that employers are required to withhold tax from compensation according to the applicable rules.

The employer then remits the withheld tax to BIR.

The BIR Form 1601-C is the Monthly Remittance Return of Income Taxes Withheld on Compensation.

So your HRMS payroll should not stop at:

"Calculate employee tax."

It should produce the employer's compliance data as well.

17. The correct HRMS payroll architecture

For your HRMS, I recommend we build the tax engine around this structure:

                    EMPLOYEE
                       │
                       ▼
              COMPENSATION ENGINE
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
   Basic Pay       Overtime          Allowances
       │               │                │
       └───────────────┼────────────────┘
                       ▼
               GROSS COMPENSATION
                       │
                       ▼
             TAX CLASSIFICATION
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
       MWE                       Non-MWE
          │                         │
          ▼                         ▼
    MWE exemptions          Normal tax rules
          │                         │
          └────────────┬────────────┘
                       ▼
              NON-TAXABLE ITEMS
                       │
      ┌────────────────┼─────────────────┐
      ▼                ▼                 ▼
  13th Month       De Minimis       Other Exempt
      │                │                 │
      └────────────────┼─────────────────┘
                       ▼
             MANDATORY CONTRIBUTIONS
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
      SSS/GSIS     PhilHealth       Pag-IBIG
                       │
                       ▼
             TAXABLE COMPENSATION
                       │
                       ▼
                BIR TAX ENGINE
                       │
                       ▼
              WITHHOLDING TAX
                       │
                       ▼
                   NET PAY
18. What the database should store

I strongly recommend not putting Philippine tax rates directly inside the employee table.

Instead:

Employee
employee
- id
- employee_number
- employment_type
- sector
- tax_status
- mwe_status
- tax_identification_number
Tax profile
employee_tax_profile
- employee_id
- tax_status
- mwe_status
- taxpayer_classification
- effective_from
- effective_to
Tax rules
tax_rules
- id
- country
- agency
- rule_code
- tax_type
- payroll_frequency
- income_from
- income_to
- fixed_tax
- percentage_rate
- excess_over
- effective_from
- effective_to
- legal_basis
- source_document
- version
- status
Tax transaction
employee_tax_transaction
- id
- employee_id
- payroll_id
- gross_compensation
- non_taxable_compensation
- mandatory_contributions
- taxable_compensation
- tax_withheld
- adjustment
- final_tax
19. The tax engine should calculate this way

For every payroll:

1. Determine employee
2. Determine employment sector
3. Determine tax classification
4. Determine payroll period
5. Calculate gross compensation
6. Calculate supplementary compensation
7. Identify MWE status
8. Identify non-taxable benefits
9. Calculate 13th-month/benefit cumulative exemption
10. Calculate de minimis exemption
11. Calculate SSS or GSIS
12. Calculate PhilHealth
13. Calculate Pag-IBIG
14. Determine taxable compensation
15. Apply BIR withholding table
16. Calculate withholding tax
17. Apply previous tax adjustments
18. Produce net pay
19. Update annual cumulative tax
20. Perform year-end adjustment
21. Generate BIR reports
22. Generate Form 2316
20. One very important design decision

Because you are building an enterprise HRMS, I would not build the tax engine as a simple formula such as:

tax = salary * 15%

That would be fundamentally wrong.

The engine needs at least these dimensions:

Dimension	Example
Country	Philippines
Tax authority	BIR
Employee sector	Private / Government
Employee classification	MWE / Non-MWE
Payroll frequency	Daily / Weekly / Semi-monthly / Monthly
Tax year	2026
Compensation type	Basic / OT / bonus / allowance
Benefit classification	Taxable / exempt / de minimis
Contribution	SSS / GSIS / PhilHealth / Pag-IBIG
Effective date	Rule version
Annual cumulative income	Yes
Previous employer income	If applicable
Year-end adjustment	Yes

This is especially important because BIR changed the de minimis ceilings through RR 29-2025, demonstrating why the HRMS needs effective-dated statutory rules rather than hard-coded values.

Bottom line

For your Philippine HRMS, the income-tax engine should support:

Private employees

SSS
PhilHealth
Pag-IBIG
BIR withholding
MWE classification
daily/weekly/semi-monthly/monthly payroll
13th-month exemption
de minimis
overtime/holiday/night differential
annualization
year-end adjustment
BIR 1601-C
BIR 2316

Government employees

GSIS
PhilHealth
Pag-IBIG
BIR withholding
government compensation/allowances
government leave monetization
bonuses/incentives
13th-month/other-benefit rules where applicable
annualization
year-end adjustment
BIR 1601-C
BIR 2316

continue to 
Important: The examples below are for a straightforward monthly-paid employee with no bonuses, 13th-month pay, taxable allowances, dependents, loans, absences, or other adjustments. They are designed to show the mechanics for your HRMS—not to replace an employee's actual payroll record.

1. The actual payroll calculation

For a normal private employee:

Gross salary
− SSS employee share
− PhilHealth employee share
− Pag-IBIG employee share
− other non-taxable compensation
= Net taxable compensation

Then:

Net taxable compensation → BIR withholding-tax table → income tax

Then:

Gross salary − contributions − income tax = estimated net pay

BIR's current Form 1601-C actually separates these components: compensation, MWE exemption, 13th-month/other benefits, de minimis, SSS/GSIS/PhilHealth/HDMF contributions and union dues, other non-taxable compensation, taxable compensation, and tax withheld.

2. Current contribution assumptions

For these examples I'm using the current rules:

SSS

For employed private-sector workers:

Employee: 5%
Employer: 10%
Maximum MSC: ₱35,000
SSS contribution rate: 15%
ECP is employer-paid and is not deducted from the employee's salary.

For example:

₱25,000 salary → ₱1,250 employee SSS

because ₱25,000 is the MSC and the employee share is 5%.

At salaries above the SSS ceiling:

Employee SSS = ₱1,750 maximum.

PhilHealth

Current verified structure:

5% of monthly basic salary, subject to:

₱10,000 income floor
₱100,000 income ceiling
50/50 employee-employer sharing

Therefore the maximum employee share is:

₱2,500/month.

Pag-IBIG

The current Maximum Fund Salary is:

₱10,000

For employees above the applicable ₱1,500 threshold, the employee contribution is generally:

2% × ₱10,000 = ₱200

and the employer counterpart is also ₱200.

3. Actual salary comparison

Here is the first major table your HRMS should ultimately be capable of producing.

Gross monthly salary	SSS EE	PhilHealth EE	Pag-IBIG EE	Taxable compensation*	BIR tax/month*	Estimated net pay*
₱15,000	₱750	₱375	₱200	₱13,675	₱0	₱13,675
₱20,000	₱1,000	₱500	₱200	₱18,300	₱0	₱18,300
₱25,000	₱1,250	₱625	₱200	₱22,925	₱313.80	₱22,611.20
₱30,000	₱1,500	₱750	₱200	₱27,550	₱1,007.55	₱26,542.45
₱40,000	₱1,750	₱1,000	₱200	₱37,050	₱2,618.40	₱34,431.60
₱50,000	₱1,750	₱1,250	₱200	₱46,800	₱4,568.40	₱42,231.60
₱75,000	₱1,750	₱1,875	₱200	₱71,175	₱9,668.80	₱61,506.20
₱100,000	₱1,750	₱2,500	₱200	₱95,550	₱15,762.55	₱79,787.45
₱150,000	₱1,750	₱2,500	₱200	₱145,550	₱28,262.55	₱117,287.45
₱200,000	₱1,750	₱2,500	₱200	₱195,550	₱42,206.70	₱153,343.30
₱500,000	₱1,750	₱2,500	₱200	₱495,550	₱132,206.70	₱363,343.30
₱1,000,000	₱1,750	₱2,500	₱200	₱995,550	₱298,650.85	₱696,899.15

*Simplified monthly example, assuming no other taxable/non-taxable compensation or year-end adjustments.

The BIR's official withholding table is effective January 1, 2023 onward and provides separate daily, weekly, semi-monthly and monthly tables.

4. Let's examine ₱25,000 salary

This is a good example because the employee starts having income tax.

Gross

₱25,000

SSS

₱1,250

PhilHealth

5% × ₱25,000 = ₱1,250 total

Employee half:

₱625

Pag-IBIG

₱200

Taxable compensation

₱25,000 − ₱1,250 − ₱625 − ₱200

= ₱22,925

Now apply the monthly BIR table.

₱22,925 is in:

₱20,833–₱33,332

Formula:

15% of excess over ₱20,833

Therefore:

₱22,925 − ₱20,833

= ₱2,092

× 15%

= ₱313.80

So:

₱25,000 − ₱1,250 − ₱625 − ₱200 − ₱313.80

= ₱22,611.20 estimated net pay

The BIR table confirms the ₱20,833 threshold and 15% rate for this bracket.

5. Why ₱20,000 has zero tax

Gross:

₱20,000

Less:

SSS = ₱1,000
PhilHealth = ₱500
Pag-IBIG = ₱200

Taxable:

₱18,300

This is below the monthly BIR threshold of ₱20,833.

Therefore:

BIR withholding = ₱0

This is why your HRMS should never determine tax solely from gross salary.

6. ₱40,000 employee

Gross:

₱40,000

Contributions:

SSS = ₱1,750
PhilHealth = ₱1,000
Pag-IBIG = ₱200

Taxable:

₱37,050

This falls in:

₱33,333–₱66,666

BIR formula:

₱1,875 + 20% of excess over ₱33,333

Excess:

₱37,050 − ₱33,333

= ₱3,717

Tax:

₱1,875 + ₱743.40

= ₱2,618.40

Net:

₱40,000 − ₱1,750 − ₱1,000 − ₱200 − ₱2,618.40

= ₱34,431.60

7. ₱75,000 employee

Gross:

₱75,000

SSS:

₱1,750

PhilHealth:

₱1,875

Pag-IBIG:

₱200

Taxable:

₱71,175

This enters the:

₱66,667–₱166,666

bracket.

Formula:

₱8,541.80 + 25% of excess over ₱66,667

Tax:

≈ ₱9,668.80

Net:

≈ ₱61,506.20

8. ₱100,000 employee

Gross:

₱100,000

Employee deductions:

SSS = ₱1,750
PhilHealth = ₱2,500
Pag-IBIG = ₱200

Total:

₱4,450

Taxable:

₱95,550

BIR tax:

₱8,541.80 + 25% × (₱95,550 − ₱66,667)

≈ ₱15,762.55

Estimated net:

₱79,787.45

Notice something important:

The employee's SSS contribution doesn't continue increasing with salary because of the ₱35,000 MSC ceiling, while PhilHealth continues only until its ₱100,000 income ceiling.

9. ₱200,000 employee

Gross:

₱200,000

SSS:

₱1,750

PhilHealth:

₱2,500

Pag-IBIG:

₱200

Taxable:

₱195,550

This enters the:

₱166,667–₱666,666

monthly bracket.

Formula:

₱33,541.80 + 30% of excess over ₱166,667

Tax:

≈ ₱42,206.70

Estimated net:

₱153,343.30

10. ₱1,000,000 employee

At the high end:

Gross:

₱1,000,000

SSS:

₱1,750

PhilHealth:

₱2,500

Pag-IBIG:

₱200

Taxable:

₱995,550

This is above ₱666,667/month.

Formula:

₱183,541.80 + 35% of excess over ₱666,667

Tax:

≈ ₱298,650.85

Estimated net:

₱696,899.15

So the employee isn't taxed at 35% of the entire ₱1 million.

Only the amount above the relevant threshold receives the 35% marginal rate.

11. BIR's actual monthly table

For your HRMS, these are the critical monthly values:

Monthly taxable compensation	BIR computation
₱20,833 and below	₱0
₱20,833–₱33,332	15% of excess over ₱20,833
₱33,333–₱66,666	₱1,875 + 20% excess over ₱33,333
₱66,667–₱166,666	₱8,541.80 + 25% excess over ₱66,667
₱166,667–₱666,666	₱33,541.80 + 30% excess over ₱166,667
₱666,667+	₱183,541.80 + 35% excess over ₱666,667

This is directly from BIR's Annex E.

12. But now comes the complicated part: 13th month

We cannot simply calculate:

Monthly salary × 12 = taxable annual income

and stop there.

Your HRMS must track:

Regular compensation
Basic Salary
+ Regular taxable allowances
+ Other regular taxable compensation
Supplementary compensation
Overtime
Holiday Pay
Night Differential
Commission
Bonus
Taxable benefits
13th month
Other supplementary compensation

BIR specifically distinguishes regular compensation from supplementary compensation when determining withholding.

13. ₱90,000 13th-month exemption

The tax treatment also requires your HRMS to track the employee's cumulative:

13th-month pay + other qualifying benefits

because the first:

₱90,000

is generally excluded from taxable compensation.

Anything above the applicable exemption can become taxable. BIR's withholding calculator explicitly implements the ₱90,000 threshold.

Example:

13th month:

₱100,000

Tax-exempt:

₱90,000

Potentially taxable:

₱10,000

But we must also account for other qualifying benefits that consume the same exemption.

14. De minimis changed — very important for your HRMS

This is one of the biggest reasons I recommend an effective-dated tax rules engine.

BIR issued Revenue Regulations No. 29-2025 on December 22, 2025, increasing the ceilings for several de minimis benefits.

Current examples include:

Benefit	New ceiling
Medical cash allowance to dependents	₱2,000/semester / ₱333/month
Rice subsidy	₱2,500/month
Uniform/clothing	₱8,000/year
Medical assistance	₱12,000/year
Laundry	₱400/month
Achievement award	₱12,000/year
Christmas/anniversary gifts	₱6,000/year

This is exactly why we should not hard-code tax rules into your HRMS application code.

15. Your HRMS needs a tax-rule version system

I recommend this architecture:

BIR
 │
 ├── Income Tax
 │     ├── 2026
 │     ├── 2027
 │     └── future
 │
 ├── Withholding Tables
 │     ├── Daily
 │     ├── Weekly
 │     ├── Semi-Monthly
 │     └── Monthly
 │
 ├── De Minimis
 │     └── RR 29-2025
 │
 ├── 13th Month
 │     └── ₱90,000 threshold
 │
 └── MWE Rules

Then the payroll engine asks:

What tax rules are effective
on the payroll date?

rather than:

What tax rules did the programmer
hard-code in 2026?
16. The payroll engine should distinguish 5-day and 6-day employees

This connects directly to your earlier question.

For example:

Employee A

₱25,000 monthly

5-day workweek.

Employee B

₱25,000 monthly

6-day workweek.

If both are genuinely monthly-paid employees with the same monthly compensation, their BIR income tax is not automatically different simply because one works five days and the other six days.

The tax engine looks at their actual taxable compensation.

The work schedule becomes important for:

daily rate
hourly rate
overtime
holiday pay
rest-day pay
absence deductions
undertime
premium pay
payroll-period earnings

rather than creating a different income-tax bracket.

17. Daily-paid employees are different

This is where your HRMS becomes more sophisticated.

BIR has a daily withholding table.

The current table starts with:

₱685/day and below → ₱0 withholding

and then progresses through the 15%, 20%, 25%, 30% and 35% brackets.

So your system must know:

Payroll Frequency
    ↓
Daily
Weekly
Semi-Monthly
Monthly

It cannot simply use the monthly table for everyone.

18. Government employee

Now let's compare the government side.

A regular GSIS-covered government employee generally has:

GSIS employee contribution = 9% of actual monthly salary

and government agency:

12%

according to the current GSIS contribution page.

So a ₱40,000 government employee would have:

GSIS:

₱3,600

rather than the private-sector SSS contribution.

The tax engine then considers the employee's taxable compensation after the applicable non-taxable amounts and mandatory contributions.

BIR's Form 1601-C explicitly supports both:

Private withholding agent

and

Government withholding agent.

19. The really important difference

Your HRMS should therefore have:

EMPLOYEE
   │
   ├── PRIVATE
   │     ├── SSS
   │     ├── PhilHealth
   │     ├── Pag-IBIG
   │     └── BIR
   │
   └── GOVERNMENT
         ├── GSIS
         ├── PhilHealth
         ├── Pag-IBIG
         └── BIR

And not:

employee
    ↓
tax = salary × rate
20. Employer cost is different from employee deductions

This is another critical HRMS distinction.

For a ₱25,000 private employee:

Employee side

SSS: ₱1,250
PhilHealth: ₱625
Pag-IBIG: ₱200
BIR: ₱313.80

These reduce the employee's take-home pay.

Employer side

The employer additionally pays its own:

SSS share
PhilHealth share
Pag-IBIG share
ECP
and potentially other statutory employer costs.

Employer contributions must NOT be deducted from the employee's gross salary.

SSS, for example, explicitly separates the employee and employer contributions and states that ECP is employer-paid.

21. This gives us the HRMS payroll model

I would now freeze this conceptual formula:

                    EMPLOYEE
                       │
                       ▼
                 GROSS EARNINGS
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
      REGULAR                  SUPPLEMENTARY
    COMPENSATION                COMPENSATION
          │                         │
          └────────────┬────────────┘
                       ▼
              TAX CLASSIFICATION
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
            MWE                NON-MWE
             │                   │
             └─────────┬─────────┘
                       ▼
              NON-TAXABLE ITEMS
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
    13TH MONTH      DE MINIMIS      OTHER EXEMPT
                       │
                       ▼
              EMPLOYEE CONTRIBUTIONS
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
      SSS/GSIS     PHILHEALTH       PAG-IBIG
                       │
                       ▼
             TAXABLE COMPENSATION
                       │
                       ▼
             BIR WITHHOLDING ENGINE
                       │
                       ▼
                INCOME TAX
                       │
                       ▼
                   NET PAY
22. One correction/clarification from the earlier research

I want to be precise here: the BIR withholding table is a withholding mechanism; it is not the same thing as calculating the employee's final annual income-tax liability by simply applying the monthly table 12 times.

Your HRMS needs cumulative/year-end reconciliation, particularly when employees receive:

salary increases
overtime
bonuses
commissions
13th-month pay
taxable allowances
de minimis benefits
leave monetization
mid-year employment
separation
transfer from another employer.

BIR Form 1601-C itself has fields for adjustments from previous months and year-end adjustments, confirming that the payroll process must accommodate reconciliation.

23. What I recommend we research next

We now have the basic BIR tax engine.

The next research should be the complete Philippine payroll calculation engine, in this order:

A. Working-time calculation
5-day schedule
6-day schedule
daily rate
hourly rate
monthly equivalent rate
8-hour normal work
overtime
rest day
special non-working holiday
regular holiday
night shift differential
double holiday
holiday + rest day
overtime + holiday
overtime + rest day
B. Employee earnings
basic salary
allowance
commission
incentive
bonus
OT
holiday pay
night differential
leave conversion
salary deduction
absence
undertime
C. Statutory deductions
SSS
PhilHealth
Pag-IBIG
GSIS
BIR
D. Statutory benefits
13th month
service incentive leave
maternity
paternity
solo parent
sick leave
vacation
government leave
retirement
separation
disability
death
unemployment
E. Employer statutory cost

Then we can produce the final formula:

Gross Salary → Earnings → Premiums → Statutory Benefits → Statutory Deductions → BIR → Net Pay → Employer Cost → Government Remittance → Reports
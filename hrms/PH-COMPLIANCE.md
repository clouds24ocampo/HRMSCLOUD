# Philippine payroll compliance: what is coded, how it is checked, what is not

Source documents: `taxation.md`, `Payrollguidel.md`, `benefitsguide.md` (`docs/` at the project root). Figures were also spot-checked against the BIR Annex E withholding table (RR 11-2018), the SSS 2025 schedule and BIR RR 29-2025.

**Read this first.** Code cannot make payroll "100% compliant" by itself. Rates and rules change by circular, and some rules depend on facts only your company knows. So the system is built to *follow dated rules you can see and change*, to *warn instead of guess*, and to *explain every number*. Have a payroll practitioner confirm the installed rules and run a trial payroll next to your current computation before the first real payroll.

## How flexibility works

| Company situation | Where you set it |
|---|---|
| Private or government employee | Employee page, Tax and contributions |
| Minimum wage earner, not subject to withholding, not covered by SSS/GSIS, PhilHealth or Pag-IBIG (job order, contract of service, special groups) | Same place, checkboxes |
| 5-day, 6-day, every-day pay, or your own days a year (261, 313, 365, custom) | Same place (suggested from the work schedule) |
| Region minimum wage | Pay setup, Philippine rules, Wage orders |
| Contributions in every pay period or once a month | Pay setup |
| A rate or ceiling changes (new circular) | Philippine rules: add a version with a start date; the old one ends the day before |
| Pay more than the law requires (overtime rate, paid special days) | Pay factors (overtime %), premium rule (unworked special days) |
| New benefit with its own tax treatment | Pay item: taxable, not taxable, de minimis (with ceiling), counts toward the ₱90,000 exemption, before-tax deduction, counts for SSS base, untaxed for minimum wage earners |
| Holidays proclaimed this year | Holiday calendar |
| Two kinds of organization in one system | Rules are per organization; "Entered by hand" payroll still works exactly as before |

Every payslip stores a copy of the rules and inputs it used, so a finalized payslip can be explained after the rules change.

## Requirement by requirement

Legend: ✅ coded and tested · 🟡 coded with a stated limit · ❌ not built.

### Wage and schedule (Payrollguidel.md)
| Requirement | Status | Notes / proof |
|---|---|---|
| Daily rate, hourly rate, monthly equivalent kept separate | ✅ | `rates()`; tests reproduce ₱766.77, ₱919.54, ₱1,150.16 and ₱143.77 an hour from the guide |
| 313, 261, 365 and custom factors, not hard-coded | ✅ | Per employee; same tax for 5- and 6-day staff, different daily rate and absence deduction (tested) |
| Daily-paid monthly equivalent = daily × factor ÷ 12 | ✅ | Used for contribution base |
| Monthly, daily, hourly pay | ✅ | |
| Rest days configurable | ✅ | From the work schedule (days off) |
| Wage orders by region with dates; warn below minimum | ✅ | Matched by region name; the "sector" text is stored but not used for matching |
| Warn when a minimum wage earner is above the minimum | ✅ | |
| Employment type (regular, probationary, project, fixed-term) | ❌ | Not modeled. It does not change pay, only some leave eligibility |
| Compressed work week | 🟡 | One "hours per day" for the organization |

### Premium pay (the matrix the guides said to research next)
| Day type | Status |
|---|---|
| Ordinary day overtime 125% | ✅ (never below your own overtime %, which can be higher) |
| Rest day 130%, special non-working 130%, both 150% | ✅ |
| Regular holiday 200%, with rest day 260%, double holiday 300%, with rest day 390% | ✅ |
| Overtime on a rest day or holiday: 130% of that day's rate | ✅ |
| Night differential 10%, 10pm to 6am, from the real clock times, overtime and regular hours separate | ✅ |
| Unworked regular holiday: paid to monthly staff (already in salary), and to daily and hourly staff who were present or on paid leave the day before | ✅ |
| Unworked special non-working day | ✅ "no work, no pay" unless the company turns on paying it |
| Special working day | ✅ ordinary rate |
| Overtime is paid only when approved; premium days pay actual worked hours up to the normal hours | 🟡 Company policy choice, same as the existing overtime approval |

### Contributions (benefitsguide.md)
| Requirement | Status | Notes |
|---|---|---|
| SSS: salary credit table, ₱5,000 to ₱35,000, 5% employee, 10% employer, EC ₱10/₱30 employer only, MPF split above ₱20,000 | ✅ | Salary credit rounds to the nearest ₱500 (tested at the edges). Matches the guide's ₱15,000 to ₱1,000,000 examples |
| PhilHealth 5%, ₱10,000 floor, ₱100,000 ceiling, split equally; absences do not lower it | ✅ | Based on the monthly equivalent, not what was earned after absences |
| Pag-IBIG 1% up to ₱1,500 then 2%, employer 2%, fund salary ₱10,000 | ✅ | |
| GSIS 9% employee, 12% government, actual salary | ✅ | |
| Employer shares never come off the employee | ✅ | Shown as employer cost |
| Computed on the monthly pay, then spread over the month's pay periods | ✅ | Every period (split to the centavo) or once a month |
| Nothing taken from someone who earned nothing in the period | ✅ | |

### Income tax (taxation.md)
| Requirement | Status | Notes |
|---|---|---|
| Daily, weekly, semi-monthly, monthly withholding tables and the annual rates | ✅ | The guide's twelve-salary table is reproduced to the centavo (tests). One difference: the guide shows the top daily bracket as ₱6,034.00; the BIR page shows ₱6,034.30, which is what is installed |
| Taxable pay = gross − exempt pay − employee contributions | ✅ | |
| Union dues and other pre-tax deductions | ✅ | Pay item flag |
| Minimum wage earner: basic pay, holiday, overtime, night, hazard exempt; other pay taxed | ✅ | |
| 13th month pay = one twelfth of basic pay earned in the year | ✅ | Own payroll run; waits for earlier payrolls to be finalized and warns if they are not |
| ₱90,000 yearly exemption shared by 13th month and other benefits, tracked across the year | ✅ | |
| De minimis ceilings (RR 29-2025) by month, semester and year; excess joins the ₱90,000 pool | ✅ | Effective January 6, 2026 |
| Taxable excess is taxed by the year-end adjustment | ✅ | Warns if it is left untaxed |
| Year-end adjustment (annualization) with refund or additional tax | ✅ | Includes earlier employers' figures |
| Earlier employer data from BIR 2316 | ✅ | Per employee, per year |
| Government bonuses are taxable unless within the pool | ✅ | Counted in the pool, not assumed exempt |
| Previous de minimis ceilings (before 2026-01-06) | ❌ | Sources disagree on the old amounts, so none are installed: such a payroll treats those items as taxable and says so. Add the old versions if you must reprocess 2025 |
| Fringe benefits tax | ❌ | |
| Taxable separation or retirement pay | ❌ | Use adjustments after your practitioner confirms the amount |
| Periodic withholding on bonuses and overtime | 🟡 | Overtime and premiums join the period's taxable pay; the year-end adjustment settles the difference |

### Reports and filing
| Output | Status | Notes |
|---|---|---|
| SSS, GSIS, PhilHealth and Pag-IBIG remittance lists with employee, employer and EC | ✅ | On screen and CSV; flags missing ID numbers |
| BIR 1601-C figures (monthly) | ✅ | The numbers for the form; file through eBIRForms or eFPS |
| BIR 2316 data (yearly, per employee, printable) | ✅ | Not the official form layout |
| 1604-C alphalist, SSS R-3/R-5 file formats, PhilHealth RF-1, Pag-IBIG MCRF upload files | ❌ | CSV lists carry the data; agency file formats are not generated |

### Government employees
| Requirement | Status |
|---|---|
| GSIS, PhilHealth, Pag-IBIG, BIR with no SSS | ✅ |
| Mid-year bonus (one month), year-end bonus (one month + ₱5,000), service requirement checked | ✅ (confirm the service rule each year) |
| PEI, SRI and other yearly incentives | 🟡 Add a rule for the year when authorized (months of pay and/or a fixed amount, service requirement); it then pays like the others |
| Civil Service leave types (vacation, sick, special privilege, adoption, wellness, calamity) and statutory private leaves | 🟡 Added as ordinary leave types with the usual days. No monthly accrual, no forced-leave tracking |
| Terminal leave and GSIS retirement | 🟡 Estimates only (Benefit estimates page); actual payment goes through adjustments |

### Agency benefits and claims
| Benefit | Status |
|---|---|
| SSS sickness and maternity estimates, employer maternity differential | 🟡 Estimates |
| SSS disability, retirement, death, funeral, unemployment, EC; PhilHealth case rates; Pag-IBIG provident, MPL, calamity, housing; GSIS unemployment, survivorship, funeral, life insurance | ❌ Paid by the agencies. Loan repayments are entered as pay deductions |
| Claim workflow (eligibility check, documents, submission, reimbursement) | ❌ Not built |
| Special groups (teachers, uniformed personnel, job-order, contract-of-service, GOCCs, LGUs) | 🟡 Coverage switches only; no special formulas |

## How it is checked

* `src/lib/ph/ph.test.ts`: 75 unit tests (rates, tables, edge cases, every row of the guide's salary table, premium multipliers, night hours from clock times, year-end, 13th month, de minimis windows, benefit estimates).
* `e2e/philippines.spec.ts`: 11 browser tests running the real screens: install rules, new versions and overlaps, holidays, wage orders, tax profile, a monthly payroll against the guide's ₱25,000 and ₱30,000 examples, a weekly daily-paid payroll with a worked holiday computed by hand, approval and finalize, the remittance and BIR pages and CSVs, 13th month with a year-end refund, a government bonus, leaving people out, and access control.
* The manual payroll (entered rates) keeps its own tests untouched.

## What to do before relying on it

1. Install the rules (Pay setup → Philippine rules), then check "Coverage today" shows complete.
2. Set each employee's tax profile and ID numbers; add wage orders and the holiday calendar.
3. Run a trial payroll for a past period and compare with your current computation line by line (every payslip line explains itself).
4. Have a payroll practitioner confirm the rule versions, especially after any new circular.

Yes. I researched the Philippine DOLE/NWPC rules, and there is an important distinction we should build into your HRMS:

A 5-day workweek and a 6-day workweek can use different annual factors when converting a daily wage into an equivalent monthly wage.

The key official source is the National Wages and Productivity Commission (NWPC), under DOLE.

1. The Philippine basic rule

The Labor Code provides that normal working hours generally cannot exceed 8 hours per day. The fact that an employee works 5 or 6 days per week affects the work schedule and wage computation, but does not mean the employee can simply be paid a lower daily rate because they work fewer days.

For HRMS purposes, I recommend separating:

Daily Rate
Work Schedule
Pay Frequency
Monthly Salary
Equivalent Monthly Minimum Wage
Actual payroll computation

These should not be one hard-coded formula.

2. The two workweek options

Your HRMS should allow:

Option A — 6-Day Workweek

Example:

Monday–Saturday
Sunday = rest day

The NWPC's current guidance uses the 313-day factor for employees who do not work and are not considered paid on Saturdays/Sundays or other rest days.

The formula is:

Equivalent Monthly Minimum Wage = Daily Rate × 313 ÷ 12

The 2024 NWPC handbook explains the 313-day factor as ordinary working days + regular holidays + special non-working days.

Therefore:

Daily Rate = Monthly Equivalent Wage × 12 ÷ 313

Option B — 5-Day Workweek

Example:

Monday–Friday
Saturday/Sunday = rest days

NWPC uses the 261-day factor for employees who do not work and are not considered paid on Saturdays, Sundays or rest days.

Formula:

Equivalent Monthly Minimum Wage = Daily Rate × 261 ÷ 12

Therefore:

Daily Rate = Monthly Equivalent Wage × 12 ÷ 261

3. Very important for your HRMS

This is where many payroll systems make mistakes.

Suppose we have:

₱20,000 monthly equivalent salary

6-day workweek

Using 313:

₱20,000 × 12 ÷ 313

= ₱766.77/day

5-day workweek

Using 261:

₱20,000 × 12 ÷ 261

= ₱919.54/day

So the daily rate is different because the employee has a different number of compensable/work-related days in the annual equivalent calculation.

But we should not simply say that a 5-day employee earns more because they work fewer days. The employee's employment arrangement, salary basis, holidays, rest days, company policy, and applicable wage order all have to be considered.

4. Why 261 vs. 313?

The NWPC explains the factors approximately as follows under its current framework:

Work arrangement	Annual factor
Paid all calendar days	365
Does not work/is not paid on Sundays/rest days	313
Does not work/is not paid on Saturdays & Sundays/rest days	261

The NWPC specifically describes the 261-day calculation as including ordinary working days plus regular holidays and special non-working days.

So for your HRMS, I would not label these simply as "5 days = 261, 6 days = 313".

Instead:

Work Schedule
    ↓
Number of Scheduled Workdays
    ↓
Rest Day Pattern
    ↓
Holiday Pay Treatment
    ↓
Annual Wage Factor
    ↓
Daily Equivalent Rate

That will make the system much safer.

5. There is another important category: monthly-paid employees

The NWPC also recognizes monthly-paid employees.

For employees whose monthly salary covers the relevant calendar days, the NWPC provides:

EMR = Applicable Daily Rate × 365 ÷ 12

The 365-day factor represents the calendar year, including ordinary working days, rest days, regular holidays and special days.

This is why I strongly recommend that our HRMS does not have one universal "Monthly Salary ÷ 26" formula.

The old 26-day calculation appears in older Philippine cases and practices, but it should not be blindly hard-coded into a modern HR/payroll system. The Supreme Court has recognized that the appropriate divisor depends on the employee's actual work arrangement and how holiday pay is incorporated into the salary.

6. Why this is important for our HRMS

I recommend creating a Compensation & Work Schedule Engine rather than putting formulas directly inside payroll.

For example:

Employee
   │
   ├── Employment Type
   │      ├── Regular
   │      ├── Probationary
   │      ├── Project
   │      └── Fixed-Term
   │
   ├── Pay Type
   │      ├── Monthly
   │      ├── Daily
   │      └── Hourly
   │
   ├── Work Schedule
   │      ├── 5-Day
   │      ├── 6-Day
   │      ├── Compressed
   │      ├── Shift
   │      └── Custom
   │
   ├── Rest Days
   │      ├── Saturday/Sunday
   │      ├── Sunday
   │      └── Custom
   │
   ├── Holiday Pay Treatment
   │
   └── Wage Rate
          ↓
     Compensation Engine
          ↓
     Daily Rate
     Hourly Rate
     OT Rate
     Holiday Rate
     Rest-Day Rate
     Leave Conversion
     13th Month Basis

This is much closer to how an enterprise HRMS/payroll system should be designed.

7. Example for our HRMS

Let's say we have:

Employee A

Monthly salary: ₱30,000
Workweek: 6 days
Rest day: Sunday

The system should know the applicable wage-factor configuration and calculate the corresponding daily/hourly rate according to the employee's compensation arrangement.

For a 313-factor equivalent:

Daily equivalent

₱30,000 × 12 ÷ 313

= ₱1,150.16

Hourly:

₱1,150.16 ÷ 8

= ₱143.77/hour

Then the payroll engine can use the underlying regular hourly/daily rate for:

Regular work
Overtime
Rest-day work
Special non-working day
Regular holiday
Night shift differential
Undertime
Leave conversion
Other applicable premiums

The Labor Code specifically establishes the normal workday at up to 8 hours and provides additional compensation rules for overtime/rest-day/holiday work.

8. But there's a major issue we need to solve

For your HRMS, we should not hard-code 261 and 313 permanently.

Why?

Because Philippine wage computation can depend on:

Region
Applicable Regional Wage Order
Industry/sector
Number of employees in some cases
Employee classification
Monthly-paid vs daily-paid
5-day vs 6-day schedule
Whether rest days are paid
Holiday treatment
Company policy
Employment contract/CBA
Applicable statutory benefits

For example, the NWPC recently issued wage-related updates affecting different regions, and wage rates are established by the applicable Regional Tripartite Wages and Productivity Board.

So our HRMS should have a configurable Wage Rules Engine.

9. Recommended HRMS database design

I would eventually create something like:

work_schedules
-------------------------
id
name
work_days_per_week
hours_per_day
rest_day_pattern
pay_basis
annual_factor
holiday_pay_policy
effective_date
expiry_date
status

And:

employee_compensation
-------------------------
id
employee_id
pay_type
basic_salary
daily_rate
hourly_rate
work_schedule_id
wage_region_id
effective_date
end_date

And:

wage_orders
-------------------------
id
region
wage_order_number
sector
daily_minimum_rate
effective_date
expiry_date
status

Then:

payroll_rules
-------------------------
id
rule_code
rule_name
formula
effective_date
version
status

This lets us change a government wage order without rewriting the payroll software.

10. One more important point: minimum wage

The daily minimum wage is not something we calculate ourselves from the employee's desired monthly salary.

The applicable Regional Wage Board determines the statutory minimum wage. The employer must comply with the applicable wage order. The Labor Code provides that regional minimum wages are prescribed by the Regional Tripartite Wages and Productivity Boards.

For example, DOLE/NWPC has recently published different wage adjustments for NCR, CALABARZON and other regions.

Therefore our HRMS should have:

Employee Location
       ↓
Region
       ↓
Applicable Wage Order
       ↓
Employee Sector / Classification
       ↓
Minimum Daily Wage
       ↓
Employee Compensation
       ↓
Payroll Validation

That allows the HRMS to warn:

Basic daily rate is below the applicable statutory minimum wage.

My recommendation for your HRMS

I would make Work Schedule & Wage Configuration one of the foundational components before we build payroll.

The employee setup should eventually have:

Work Arrangement

5-Day Workweek
6-Day Workweek
Custom Workweek

Pay Basis

Monthly Paid
Daily Paid
Hourly Paid

Hours

Regular hours/day: 8
Scheduled days/week: 5 or 6
Rest days: configurable

Compensation

Monthly Basic Salary
Daily Rate
Hourly Rate
Minimum Wage Reference
Wage Region
Wage Order
Effective Date

Payroll Rules

Ordinary Day
Rest Day
Special Non-Working Day
Regular Holiday
Overtime
Night Shift Differential
Undertime
Leave
13th Month
Other company benefits

This will give us a proper Philippine payroll foundation, rather than building payroll around a simplistic salary / 26 formula.

One especially important finding from the official NWPC material is that 261 and 313 are suggested equivalent-monthly-rate factors, not universal payroll divisors for every possible purpose. The HRMS needs to know why it is calculating a daily rate before selecting the applicable formula.

If we're going to build this HRMS seriously, I recommend our next research step be the complete Philippine payroll computation matrix: 5-day vs 6-day × monthly-paid vs daily-paid × regular day/rest day/special holiday/regular holiday × OT/NSD, with the exact formulas we can convert into our HRMS rules engine.

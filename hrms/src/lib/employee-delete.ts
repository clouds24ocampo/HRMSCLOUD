// Every table whose rows point at an employee with "no action on delete" (the database refuses to delete the employee while such
// a row exists). deleteEmployee (employees/actions.ts) removes the rows of each of these first. If you add a table that points at
// Employee, add it to the delete there AND to this list: the test in employee-delete.test.ts fails until you do, so a new table can
// never again make "Delete employee" fail with a blank error page.
export const EMPLOYEE_RESTRICT_TABLES = [
  "CashAdvance", "ChecklistItem", "Compensation", "DailyReport", "EmployeeComponent", "EmployeeDocument", "EmployeeTaxProfile", "EmploymentHistory",
  "Enrollment", "Goal", "HrRequest", "LeaveRequest", "OvertimeRequest", "PayrollAdjustment", "Payslip", "PolicySignature", "PreviousEmployment",
  "RegularSchedule", "Review", "ScheduleEntry", "TimeEvent",
] as const;

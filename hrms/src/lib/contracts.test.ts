import { describe, expect, it } from "vitest";
import { interpolateContract, type EmployeeContractData } from "./contracts";

describe("Contract Variable Interpolation", () => {
  const sampleData: EmployeeContractData = {
    name: "Maria Lourdes Santos",
    address: "Unit 304, Emerald Tower, Ortigas Center, Pasig City",
    position: "Senior Systems Analyst",
    department: "Information Technology",
    salary: "₱65,000.00 (monthly)",
    startDate: "October 18, 2026",
    employeeNo: "20261018-0001",
    companyName: "Acme Cloud Philippines Inc.",
  };

  it("replaces exact employee name, address, position, department, and salary", () => {
    const rawTemplate = `EMPLOYMENT AGREEMENT
Between {{company_name}} and {{employee_name}}, residing at {{employee_address}}.
Position: {{position}}
Department: {{department}}
Monthly Compensation: {{salary}}
Commencement: {{start_date}}
Employee ID: {{employee_no}}`;

    const result = interpolateContract(rawTemplate, sampleData);

    expect(result).toContain("Acme Cloud Philippines Inc.");
    expect(result).toContain("Maria Lourdes Santos");
    expect(result).toContain("Unit 304, Emerald Tower, Ortigas Center, Pasig City");
    expect(result).toContain("Senior Systems Analyst");
    expect(result).toContain("Information Technology");
    expect(result).toContain("₱65,000.00 (monthly)");
    expect(result).toContain("October 18, 2026");
    expect(result).toContain("20261018-0001");
  });

  it("handles alternative {{address}} placeholder seamlessly", () => {
    const rawTemplate = `Address of employee: {{address}}`;
    const result = interpolateContract(rawTemplate, sampleData);
    expect(result).toBe("Address of employee: Unit 304, Emerald Tower, Ortigas Center, Pasig City");
  });

  it("provides graceful fallbacks if some fields are missing", () => {
    const emptyData: EmployeeContractData = {
      name: "",
      address: "",
      position: "",
      department: "",
      salary: "",
      startDate: "",
      employeeNo: "",
      companyName: "",
    };

    const raw = `Name: {{employee_name}}, Address: {{employee_address}}, Position: {{position}}`;
    const result = interpolateContract(raw, emptyData);
    expect(result).toContain("____________________");
    expect(result).toContain("Staff");
  });
});

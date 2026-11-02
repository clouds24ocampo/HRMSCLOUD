-- Digital ID, back side: government numbers on the employee, and the card design's address, terms and validity.
ALTER TABLE "Employee" ADD COLUMN "sssNo" TEXT, ADD COLUMN "philhealthNo" TEXT, ADD COLUMN "tinNo" TEXT, ADD COLUMN "pagibigNo" TEXT, ADD COLUMN "idIssuedOn" DATE;
ALTER TABLE "IdCardSettings" ADD COLUMN "address" TEXT, ADD COLUMN "terms" TEXT, ADD COLUMN "validYears" INTEGER NOT NULL DEFAULT 2;

-- Numbers already on the latest tax profile of each employee are copied over, so nothing has to be typed twice.
UPDATE "Employee" e
SET "sssNo" = p."sssNo", "philhealthNo" = p."philhealthNo", "tinNo" = p."tin", "pagibigNo" = p."pagibigNo"
FROM (SELECT DISTINCT ON ("employeeId") * FROM "EmployeeTaxProfile" ORDER BY "employeeId", "effectiveFrom" DESC, "createdAt" DESC) p
WHERE p."employeeId" = e."id";

/*
  Warnings:

  - You are about to drop the column `taxable` on the `PayComponent` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "StatutoryProfile" AS ENUM ('MANUAL', 'PHILIPPINES');

-- CreateEnum
CREATE TYPE "ContributionSchedule" AS ENUM ('EVERY_PERIOD', 'LAST_PERIOD');

-- CreateEnum
CREATE TYPE "PayrollKind" AS ENUM ('REGULAR', 'THIRTEENTH_MONTH', 'GOV_INCENTIVE');

-- CreateEnum
CREATE TYPE "TaxClass" AS ENUM ('TAXABLE', 'EXEMPT', 'DE_MINIMIS', 'OTHER_BENEFIT');

-- CreateEnum
CREATE TYPE "RuleSector" AS ENUM ('ALL', 'PRIVATE', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "StatutoryKind" AS ENUM ('SSS', 'PERCENT_CONTRIBUTION', 'WITHHOLDING_TABLE', 'ANNUAL_TAX_TABLE', 'DE_MINIMIS', 'BENEFITS_POOL', 'PREMIUM_PAY', 'INCENTIVE');

-- CreateEnum
CREATE TYPE "EmployeeSector" AS ENUM ('PRIVATE', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "WageBasis" AS ENUM ('SIX_DAY_313', 'FIVE_DAY_261', 'ALL_DAYS_365', 'CUSTOM');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('REGULAR', 'SPECIAL_NON_WORKING', 'SPECIAL_WORKING');

-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "contributionSchedule" "ContributionSchedule" NOT NULL DEFAULT 'EVERY_PERIOD',
ADD COLUMN     "statutoryProfile" "StatutoryProfile" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "PayComponent" DROP COLUMN "taxable",
ADD COLUMN     "deMinimisCode" TEXT,
ADD COLUMN     "inContributionBase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mweExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preTax" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxClass" "TaxClass" NOT NULL DEFAULT 'TAXABLE';

-- AlterTable
ALTER TABLE "PayrollPeriod" ADD COLUMN     "incentiveCode" TEXT,
ADD COLUMN     "kind" "PayrollKind" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "skipEmployeeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "yearEnd" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "basicEarnedCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "benefitsExemptCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "benefitsTaxableCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mandatoryEeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mweExemptCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nonTaxableCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxWithheldCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxableCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StatutoryRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "StatutoryKind" NOT NULL,
    "sector" "RuleSector" NOT NULL DEFAULT 'ALL',
    "name" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "legalBasis" TEXT NOT NULL,
    "note" TEXT,
    "packVersion" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatutoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeTaxProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sector" "EmployeeSector" NOT NULL DEFAULT 'PRIVATE',
    "mwe" BOOLEAN NOT NULL DEFAULT false,
    "wageBasis" "WageBasis" NOT NULL DEFAULT 'FIVE_DAY_261',
    "customFactor" INTEGER,
    "wageRegion" TEXT,
    "socialCovered" BOOLEAN NOT NULL DEFAULT true,
    "philhealthCovered" BOOLEAN NOT NULL DEFAULT true,
    "pagibigCovered" BOOLEAN NOT NULL DEFAULT true,
    "withholdingApplies" BOOLEAN NOT NULL DEFAULT true,
    "tin" TEXT,
    "sssNo" TEXT,
    "philhealthNo" TEXT,
    "pagibigNo" TEXT,
    "gsisNo" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeTaxProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WageOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "sector" TEXT,
    "dailyMinimumCents" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WageOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HolidayType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreviousEmployment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "employerName" TEXT NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "taxableCents" INTEGER NOT NULL,
    "nonTaxableCents" INTEGER NOT NULL DEFAULT 0,
    "benefitsExemptCents" INTEGER NOT NULL DEFAULT 0,
    "benefitsTaxableCents" INTEGER NOT NULL DEFAULT 0,
    "mandatoryCents" INTEGER NOT NULL DEFAULT 0,
    "taxWithheldCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreviousEmployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatutoryRule_organizationId_code_effectiveFrom_idx" ON "StatutoryRule"("organizationId", "code", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeeTaxProfile_employeeId_effectiveFrom_idx" ON "EmployeeTaxProfile"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeeTaxProfile_organizationId_idx" ON "EmployeeTaxProfile"("organizationId");

-- CreateIndex
CREATE INDEX "WageOrder_organizationId_region_effectiveFrom_idx" ON "WageOrder"("organizationId", "region", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Holiday_organizationId_date_idx" ON "Holiday"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_organizationId_date_name_key" ON "Holiday"("organizationId", "date", "name");

-- CreateIndex
CREATE INDEX "PreviousEmployment_employeeId_year_idx" ON "PreviousEmployment"("employeeId", "year");

-- AddForeignKey
ALTER TABLE "StatutoryRule" ADD CONSTRAINT "StatutoryRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTaxProfile" ADD CONSTRAINT "EmployeeTaxProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTaxProfile" ADD CONSTRAINT "EmployeeTaxProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WageOrder" ADD CONSTRAINT "WageOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreviousEmployment" ADD CONSTRAINT "PreviousEmployment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreviousEmployment" ADD CONSTRAINT "PreviousEmployment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "flexible" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "daysPerYear" INTEGER NOT NULL DEFAULT 313,
ADD COLUMN     "deductStatutory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payByLoggedHours" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "OvertimeRequest" ADD COLUMN     "headApprovedAt" TIMESTAMP(3),
ADD COLUMN     "headApprovedById" TEXT;

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "accomplishments" TEXT NOT NULL,
    "issues" TEXT,
    "plans" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyReport_organizationId_date_idx" ON "DailyReport"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_employeeId_date_key" ON "DailyReport"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "IncentiveStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'PAID');

-- CreateTable
CREATE TABLE "Incentive" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "IncentiveStatus" NOT NULL DEFAULT 'PENDING',
    "awardedById" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "employeeNote" TEXT,
    "projectId" TEXT,
    "cardId" TEXT,
    "payslipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incentive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Incentive_organizationId_status_idx" ON "Incentive"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Incentive_employeeId_status_idx" ON "Incentive"("employeeId", "status");

-- AddForeignKey
ALTER TABLE "Incentive" ADD CONSTRAINT "Incentive_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incentive" ADD CONSTRAINT "Incentive_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

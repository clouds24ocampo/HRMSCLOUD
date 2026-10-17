-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('WAITING', 'CONFIRMED', 'DISPUTED');

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "paidOn" DATE NOT NULL,
    "proofKey" TEXT,
    "proofName" TEXT,
    "proofMime" TEXT,
    "recordedById" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'WAITING',
    "answeredAt" TIMESTAMP(3),
    "employeeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payout_proofKey_key" ON "Payout"("proofKey");

-- CreateIndex
CREATE INDEX "Payout_payslipId_idx" ON "Payout"("payslipId");

-- CreateIndex
CREATE INDEX "Payout_organizationId_status_idx" ON "Payout"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


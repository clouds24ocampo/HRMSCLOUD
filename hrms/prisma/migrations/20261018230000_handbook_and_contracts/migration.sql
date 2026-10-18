-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "address" TEXT;

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ISSUED', 'SIGNED', 'VOID');

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL DEFAULT 'REGULAR',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "issuedById" TEXT,
    "signedAt" TIMESTAMP(3),
    "signatureIp" TEXT,
    "signatureNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandbookSection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandbookSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandbookAcknowledgment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signatureIp" TEXT,
    "note" TEXT,

    CONSTRAINT "HandbookAcknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contract_organizationId_status_idx" ON "Contract"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Contract_employeeId_status_idx" ON "Contract"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HandbookSection_organizationId_slug_key" ON "HandbookSection"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "HandbookSection_organizationId_sortOrder_idx" ON "HandbookSection"("organizationId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "HandbookAcknowledgment_employeeId_version_key" ON "HandbookAcknowledgment"("employeeId", "version");

-- CreateIndex
CREATE INDEX "HandbookAcknowledgment_organizationId_version_idx" ON "HandbookAcknowledgment"("organizationId", "version");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandbookSection" ADD CONSTRAINT "HandbookSection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandbookAcknowledgment" ADD CONSTRAINT "HandbookAcknowledgment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandbookAcknowledgment" ADD CONSTRAINT "HandbookAcknowledgment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

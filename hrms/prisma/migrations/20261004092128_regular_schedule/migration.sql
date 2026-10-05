-- CreateTable
CREATE TABLE "RegularSchedule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "workDays" INTEGER[],
    "effectiveFrom" DATE NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegularSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegularSchedule_employeeId_effectiveFrom_idx" ON "RegularSchedule"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "RegularSchedule_organizationId_idx" ON "RegularSchedule"("organizationId");

-- AddForeignKey
ALTER TABLE "RegularSchedule" ADD CONSTRAINT "RegularSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegularSchedule" ADD CONSTRAINT "RegularSchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegularSchedule" ADD CONSTRAINT "RegularSchedule_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "ShiftTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

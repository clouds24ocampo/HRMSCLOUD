-- CreateTable
CREATE TABLE "PersonalDataSheet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "employeeId" TEXT,
    "data" JSONB NOT NULL,
    "completePct" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalDataSheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonalDataSheet_profileId_key" ON "PersonalDataSheet"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalDataSheet_employeeId_key" ON "PersonalDataSheet"("employeeId");

-- CreateIndex
CREATE INDEX "PersonalDataSheet_organizationId_idx" ON "PersonalDataSheet"("organizationId");

-- AddForeignKey
ALTER TABLE "PersonalDataSheet" ADD CONSTRAINT "PersonalDataSheet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalDataSheet" ADD CONSTRAINT "PersonalDataSheet_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ApplicantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalDataSheet" ADD CONSTRAINT "PersonalDataSheet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE "ApplicantContract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "engagement" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "templateKey" TEXT NOT NULL DEFAULT 'REGULAR',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "startDate" DATE,
    "status" "ContractStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3),
    "issuedById" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedName" TEXT,
    "signatureKey" TEXT,
    "signatureIp" TEXT,
    "signatureAgent" TEXT,
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicantContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicantContract_applicantId_status_idx" ON "ApplicantContract"("applicantId", "status");

-- CreateIndex
CREATE INDEX "ApplicantContract_organizationId_idx" ON "ApplicantContract"("organizationId");

-- AddForeignKey
ALTER TABLE "ApplicantContract" ADD CONSTRAINT "ApplicantContract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantContract" ADD CONSTRAINT "ApplicantContract_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


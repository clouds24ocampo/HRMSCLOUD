-- Orientation day (applicants sign the company policies), and the employee's date of birth for the account profile.
ALTER TABLE "Applicant" ADD COLUMN "orientationAt" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN "birthDate" DATE;

CREATE TABLE "ApplicantPolicySignature" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "signedName" TEXT NOT NULL,
    "signatureKey" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicantPolicySignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApplicantPolicySignature_policyId_profileId_key" ON "ApplicantPolicySignature"("policyId", "profileId");
CREATE INDEX "ApplicantPolicySignature_profileId_idx" ON "ApplicantPolicySignature"("profileId");

ALTER TABLE "ApplicantPolicySignature" ADD CONSTRAINT "ApplicantPolicySignature_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ApplicantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicantPolicySignature" ADD CONSTRAINT "ApplicantPolicySignature_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "PolicyDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "ApplicantStage" ADD VALUE 'REQUIREMENTS';

-- CreateTable
CREATE TABLE "ApplicantDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicantDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicantDocument_profileId_title_idx" ON "ApplicantDocument"("profileId", "title");

-- CreateIndex
CREATE INDEX "ApplicantDocument_organizationId_idx" ON "ApplicantDocument"("organizationId");

-- AddForeignKey
ALTER TABLE "ApplicantDocument" ADD CONSTRAINT "ApplicantDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantDocument" ADD CONSTRAINT "ApplicantDocument_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ApplicantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "StampKind" AS ENUM ('IN', 'OUT', 'PAUSE');

-- AlterEnum: rename in place so existing punches keep their meaning
ALTER TYPE "TimeEventType" RENAME VALUE 'BREAK_START' TO 'PAUSE_START';
ALTER TYPE "TimeEventType" RENAME VALUE 'BREAK_END' TO 'PAUSE_END';

-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "punchUnlockSeconds" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "requirePunchPassword" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "punchUnlockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TimeEvent" ADD COLUMN     "stampTypeId" TEXT;

-- CreateTable
CREATE TABLE "TimeStampType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '⏱️',
    "tone" TEXT NOT NULL DEFAULT 'slate',
    "kind" "StampKind" NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "allowedMinutes" INTEGER,
    "requiresNote" BOOLEAN NOT NULL DEFAULT false,
    "defaultContext" "WorkContext",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeStampType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimeStampType_organizationId_key_key" ON "TimeStampType"("organizationId", "key");

-- AddForeignKey
ALTER TABLE "TimeStampType" ADD CONSTRAINT "TimeStampType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEvent" ADD CONSTRAINT "TimeEvent_stampTypeId_fkey" FOREIGN KEY ("stampTypeId") REFERENCES "TimeStampType"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CreateEnum
CREATE TYPE "StampPage" AS ENUM ('PUNCH', 'ISSUE');

-- AlterTable
ALTER TABLE "TimeEvent" ADD COLUMN     "tripFrom" TEXT,
ADD COLUMN     "tripReason" TEXT,
ADD COLUMN     "tripTo" TEXT;

-- AlterTable
ALTER TABLE "TimeStampType" ADD COLUMN     "dailyCapMinutes" INTEGER,
ADD COLUMN     "maxPerDay" INTEGER,
ADD COLUMN     "page" "StampPage" NOT NULL DEFAULT 'PUNCH',
ADD COLUMN     "requiresOvertimeOver" INTEGER;

-- Backfill existing organizations (idempotent).
UPDATE "TimeStampType" SET "name" = 'Break 1', "maxPerDay" = 1 WHERE "key" = 'BREAK' AND "name" = 'Break';
UPDATE "TimeStampType" SET "maxPerDay" = 1 WHERE "key" = 'BREAK' AND "maxPerDay" IS NULL;
UPDATE "TimeStampType" SET "maxPerDay" = 2 WHERE "key" = 'MEAL' AND "maxPerDay" IS NULL;
UPDATE "TimeStampType" SET "dailyCapMinutes" = 10 WHERE "key" = 'BIO_BREAK' AND "dailyCapMinutes" IS NULL;
UPDATE "TimeStampType" SET "page" = 'ISSUE' WHERE "key" IN ('CLINIC_BREAK', 'SYSTEM_ISSUE');
UPDATE "TimeStampType" SET "requiresNote" = false WHERE "key" = 'ON_TRIP';

INSERT INTO "TimeStampType" ("id", "organizationId", "key", "name", "icon", "tone", "kind", "paid", "allowedMinutes", "maxPerDay", "sortOrder", "updatedAt")
SELECT 'bk2_' || o."id", o."id", 'BREAK_2', 'Break 2', '☕', 'amber', 'PAUSE', true, 15, 1, 21, NOW()
FROM "Organization" o
WHERE EXISTS (SELECT 1 FROM "TimeStampType" t WHERE t."organizationId" = o."id")
ON CONFLICT ("organizationId", "key") DO NOTHING;

INSERT INTO "TimeStampType" ("id", "organizationId", "key", "name", "icon", "tone", "kind", "paid", "allowedMinutes", "maxPerDay", "requiresOvertimeOver", "sortOrder", "updatedAt")
SELECT 'bk3_' || o."id", o."id", 'BREAK_3', 'Break 3', '☕', 'amber', 'PAUSE', true, 15, 1, 120, 22, NOW()
FROM "Organization" o
WHERE EXISTS (SELECT 1 FROM "TimeStampType" t WHERE t."organizationId" = o."id")
ON CONFLICT ("organizationId", "key") DO NOTHING;

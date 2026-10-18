-- AlterTable
ALTER TABLE "WsCard" ADD COLUMN     "completedById" TEXT;


-- Backfill: cards already finished get the person who last moved them to a done list.
UPDATE "WsCard" c
SET "completedById" = (
  SELECT a."actorId" FROM "WsActivity" a
  WHERE a."cardId" = c."id" AND a."type" = 'DONE'
  ORDER BY a."createdAt" DESC LIMIT 1
)
WHERE c."completedAt" IS NOT NULL AND c."completedById" IS NULL;

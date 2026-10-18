-- AlterTable
ALTER TABLE "WsCard" ADD COLUMN     "startDate" DATE;

-- AlterTable
ALTER TABLE "WsList" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WsProject" ADD COLUMN     "color" TEXT NOT NULL DEFAULT 'indigo';

-- CreateTable
CREATE TABLE "WsLabel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "WsLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WsCardLabel" (
    "cardId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    CONSTRAINT "WsCardLabel_pkey" PRIMARY KEY ("cardId","labelId")
);

-- CreateIndex
CREATE INDEX "WsLabel_projectId_idx" ON "WsLabel"("projectId");

-- CreateIndex
CREATE INDEX "WsCardLabel_labelId_idx" ON "WsCardLabel"("labelId");

-- AddForeignKey
ALTER TABLE "WsLabel" ADD CONSTRAINT "WsLabel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WsProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WsCardLabel" ADD CONSTRAINT "WsCardLabel_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "WsCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WsCardLabel" ADD CONSTRAINT "WsCardLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "WsLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;


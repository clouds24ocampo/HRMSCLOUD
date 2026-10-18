-- CreateEnum
CREATE TYPE "WsKind" AS ENUM ('PROGRAMMING', 'NETWORK', 'OTHER');

-- CreateEnum
CREATE TYPE "WsCategory" AS ENUM ('TODO', 'DOING', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "WsMemberRole" AS ENUM ('LEAD', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "WsPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "WsProject" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "WsKind" NOT NULL DEFAULT 'PROGRAMMING',
    "description" TEXT,
    "dueDate" DATE,
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WsProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WsMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" "WsMemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WsMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WsList" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "WsCategory" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "WsList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WsCard" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "WsPriority" NOT NULL DEFAULT 'NORMAL',
    "dueDate" DATE,
    "position" DOUBLE PRECISION NOT NULL,
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WsCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WsAssignee" (
    "cardId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "WsAssignee_pkey" PRIMARY KEY ("cardId","employeeId")
);

-- CreateTable
CREATE TABLE "WsCheck" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL,

    CONSTRAINT "WsCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WsComment" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WsComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WsActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cardId" TEXT,
    "cardTitle" TEXT,
    "actorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WsActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WsProject_organizationId_archivedAt_idx" ON "WsProject"("organizationId", "archivedAt");

-- CreateIndex
CREATE INDEX "WsMember_employeeId_idx" ON "WsMember"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "WsMember_projectId_employeeId_key" ON "WsMember"("projectId", "employeeId");

-- CreateIndex
CREATE INDEX "WsList_projectId_position_idx" ON "WsList"("projectId", "position");

-- CreateIndex
CREATE INDEX "WsCard_projectId_listId_position_idx" ON "WsCard"("projectId", "listId", "position");

-- CreateIndex
CREATE INDEX "WsCard_organizationId_archivedAt_idx" ON "WsCard"("organizationId", "archivedAt");

-- CreateIndex
CREATE INDEX "WsAssignee_employeeId_idx" ON "WsAssignee"("employeeId");

-- CreateIndex
CREATE INDEX "WsCheck_cardId_position_idx" ON "WsCheck"("cardId", "position");

-- CreateIndex
CREATE INDEX "WsComment_cardId_createdAt_idx" ON "WsComment"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "WsActivity_projectId_createdAt_idx" ON "WsActivity"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "WsActivity_organizationId_createdAt_idx" ON "WsActivity"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "WsActivity_actorId_createdAt_idx" ON "WsActivity"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "WsProject" ADD CONSTRAINT "WsProject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WsMember" ADD CONSTRAINT "WsMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WsProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WsMember" ADD CONSTRAINT "WsMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WsList" ADD CONSTRAINT "WsList_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WsProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WsCard" ADD CONSTRAINT "WsCard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WsProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WsCard" ADD CONSTRAINT "WsCard_listId_fkey" FOREIGN KEY ("listId") REFERENCES "WsList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WsAssignee" ADD CONSTRAINT "WsAssignee_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "WsCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WsAssignee" ADD CONSTRAINT "WsAssignee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WsCheck" ADD CONSTRAINT "WsCheck_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "WsCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WsComment" ADD CONSTRAINT "WsComment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "WsCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WsActivity" ADD CONSTRAINT "WsActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WsProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;


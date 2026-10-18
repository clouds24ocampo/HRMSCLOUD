-- CreateTable
CREATE TABLE "DailyReportComment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReportComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyReportComment_reportId_createdAt_idx" ON "DailyReportComment"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "DailyReportComment_organizationId_idx" ON "DailyReportComment"("organizationId");

-- AddForeignKey
ALTER TABLE "DailyReportComment" ADD CONSTRAINT "DailyReportComment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportComment" ADD CONSTRAINT "DailyReportComment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DailyReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "lang" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "ExamQuestion" ADD COLUMN     "textTl" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "completionPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startDate" TIMESTAMP(3);

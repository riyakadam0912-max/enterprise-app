/*
  Warnings:

  - You are about to drop the column `completionPercent` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "completionPercent",
DROP COLUMN "startDate";

-- AlterTable
ALTER TABLE "Timesheet" ADD COLUMN     "projectId" INTEGER,
ADD COLUMN     "taskId" INTEGER;

-- CreateIndex
CREATE INDEX "Timesheet_projectId_idx" ON "Timesheet"("projectId");

-- CreateIndex
CREATE INDEX "Timesheet_taskId_idx" ON "Timesheet"("taskId");

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

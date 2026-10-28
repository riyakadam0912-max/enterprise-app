ALTER TABLE "Task"
ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "completionPercent" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Task_projectId_startDate_dueDate_idx"
ON "Task"("projectId", "startDate", "dueDate");

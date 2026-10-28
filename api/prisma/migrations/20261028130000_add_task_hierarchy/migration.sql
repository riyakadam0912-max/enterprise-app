ALTER TABLE "Task"
ADD COLUMN "parentTaskId" INTEGER;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_parentTaskId_fkey"
FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");

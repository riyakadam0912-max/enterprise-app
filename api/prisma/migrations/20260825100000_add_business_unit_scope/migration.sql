-- Business Unit scope columns for Project and Task (additive, nullable, no data loss)

ALTER TABLE "Project" ADD COLUMN "businessUnitId" INTEGER;
CREATE INDEX "Project_businessUnitId_idx" ON "Project"("businessUnitId");
ALTER TABLE "Project" ADD CONSTRAINT "Project_businessUnitId_fkey"
  FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task" ADD COLUMN "businessUnitId" INTEGER;
CREATE INDEX "Task_businessUnitId_idx" ON "Task"("businessUnitId");
ALTER TABLE "Task" ADD CONSTRAINT "Task_businessUnitId_fkey"
  FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

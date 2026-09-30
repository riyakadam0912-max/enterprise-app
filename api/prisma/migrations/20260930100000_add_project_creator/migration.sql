ALTER TABLE "Project"
ADD COLUMN "createdById" INTEGER;

CREATE INDEX "Project_createdById_idx" ON "Project"("createdById");

ALTER TABLE "Project"
ADD CONSTRAINT "Project_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
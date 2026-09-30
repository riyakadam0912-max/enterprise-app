ALTER TABLE "Project"
ADD COLUMN "managerAssignedById" INTEGER;

CREATE INDEX "Project_managerAssignedById_idx"
ON "Project"("managerAssignedById");

ALTER TABLE "Project"
ADD CONSTRAINT "Project_managerAssignedById_fkey"
FOREIGN KEY ("managerAssignedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
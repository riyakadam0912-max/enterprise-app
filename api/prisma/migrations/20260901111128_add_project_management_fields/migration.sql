-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "category" TEXT,
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "finalDeliverablesLink" TEXT,
ADD COLUMN     "ownerId" INTEGER,
ADD COLUMN     "priority" TEXT,
ADD COLUMN     "projectType" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "specificTask" TEXT,
ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

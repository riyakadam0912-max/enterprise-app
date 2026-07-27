-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "assignedTo" TEXT,
ADD COLUMN     "contactedDate" TIMESTAMP(3),
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "leadOwner" TEXT,
ADD COLUMN     "leadScore" INTEGER,
ADD COLUMN     "nextFollowUp" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'New';

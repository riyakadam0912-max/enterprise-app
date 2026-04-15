/*
  Warnings:

  - You are about to drop the column `userId` on the `Lead` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_userId_fkey";

-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "userId",
ADD COLUMN     "assignedEmployeeId" INTEGER,
ADD COLUMN     "company" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "source" TEXT,
ALTER COLUMN "status" SET DEFAULT 'NEW';

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

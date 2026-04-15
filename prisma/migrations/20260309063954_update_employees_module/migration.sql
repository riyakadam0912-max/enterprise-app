/*
  Warnings:

  - You are about to drop the column `employeeId` on the `Deal` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `salary` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `assignedEmployeeId` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `employeeId` on the `LeaveRequest` table. All the data in the column will be lost.
  - You are about to drop the column `employeeId` on the `Timesheet` table. All the data in the column will be lost.
  - Added the required column `name` to the `Employee` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Deal" DROP CONSTRAINT "Deal_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_userId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_assignedEmployeeId_fkey";

-- DropForeignKey
ALTER TABLE "LeaveRequest" DROP CONSTRAINT "LeaveRequest_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "Timesheet" DROP CONSTRAINT "Timesheet_employeeId_fkey";

-- DropIndex
DROP INDEX "Employee_userId_key";

-- AlterTable
ALTER TABLE "Deal" DROP COLUMN "employeeId";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "fullName",
DROP COLUMN "phone",
DROP COLUMN "position",
DROP COLUMN "salary",
DROP COLUMN "userId",
ADD COLUMN     "department" TEXT,
ADD COLUMN     "designation" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "hireDate" TIMESTAMP(3),
ADD COLUMN     "leaveBalance" INTEGER,
ADD COLUMN     "manager" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "status" TEXT;

-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "assignedEmployeeId";

-- AlterTable
ALTER TABLE "LeaveRequest" DROP COLUMN "employeeId";

-- AlterTable
ALTER TABLE "Timesheet" DROP COLUMN "employeeId";

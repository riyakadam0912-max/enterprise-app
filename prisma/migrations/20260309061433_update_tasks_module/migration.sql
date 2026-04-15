/*
  Warnings:

  - You are about to drop the column `description` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Task` table. All the data in the column will be lost.
  - Added the required column `taskName` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_userId_fkey";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "description",
DROP COLUMN "title",
DROP COLUMN "userId",
ADD COLUMN     "actualHours" DOUBLE PRECISION,
ADD COLUMN     "assignee" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "estimatedHours" DOUBLE PRECISION,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "priority" TEXT,
ADD COLUMN     "project" TEXT,
ADD COLUMN     "taskName" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'Not Started';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "actualCloseDate" TIMESTAMP(3),
ADD COLUMN     "contact" TEXT,
ADD COLUMN     "owner" TEXT,
ADD COLUMN     "pipeline" TEXT;

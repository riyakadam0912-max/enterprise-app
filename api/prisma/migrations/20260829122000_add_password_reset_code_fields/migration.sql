-- AlterTable
ALTER TABLE "User"
ADD COLUMN "passwordResetCodeHash" TEXT,
ADD COLUMN "passwordResetCodeExpiresAt" TIMESTAMP(3);

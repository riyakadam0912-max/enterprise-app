-- Add missing soft-delete column for Activity to match the Prisma schema.

ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

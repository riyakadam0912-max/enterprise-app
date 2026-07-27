-- Relax legacy AuditLog columns that are no longer part of the Prisma model.
ALTER TABLE "AuditLog" ALTER COLUMN "entity" DROP NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "entityId" DROP NOT NULL;

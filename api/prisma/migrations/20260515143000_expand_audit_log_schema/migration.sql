-- Expand AuditLog to match the current Prisma schema.
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userName" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userRole" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "module" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "entityType" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "fieldName" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "oldValue" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "newValue" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "deviceInfo" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "requestMethod" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "endpoint" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "status" TEXT;

UPDATE "AuditLog"
SET "module" = COALESCE("module", 'SYSTEM'),
    "entityType" = COALESCE("entityType", 'UNKNOWN'),
    "status" = COALESCE("status", 'SUCCESS');

ALTER TABLE "AuditLog"
  ALTER COLUMN "module" SET NOT NULL,
  ALTER COLUMN "entityType" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_module_idx" ON "AuditLog"("module");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entityId_idx" ON "AuditLog"("entityId");

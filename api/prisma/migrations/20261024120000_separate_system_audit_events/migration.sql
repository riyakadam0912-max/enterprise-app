CREATE TABLE "SystemAuditEvent" (
  "id" SERIAL NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT NOT NULL,
  "targetOrganizationId" INTEGER,
  "requestedOrganizationId" INTEGER,
  "userId" INTEGER,
  "userName" TEXT,
  "userRole" TEXT,
  "module" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" INTEGER,
  "action" TEXT NOT NULL,
  "fieldName" TEXT,
  "oldValue" JSONB,
  "newValue" JSONB,
  "description" TEXT,
  "ipAddress" TEXT,
  "deviceInfo" TEXT,
  "requestMethod" TEXT,
  "endpoint" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SUCCESS',
  "correlationId" TEXT,
  "jobName" TEXT,
  CONSTRAINT "SystemAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SystemAuditEvent_createdAt_idx" ON "SystemAuditEvent"("createdAt");
CREATE INDEX "SystemAuditEvent_reason_createdAt_idx" ON "SystemAuditEvent"("reason", "createdAt");
CREATE INDEX "SystemAuditEvent_targetOrganizationId_idx" ON "SystemAuditEvent"("targetOrganizationId");

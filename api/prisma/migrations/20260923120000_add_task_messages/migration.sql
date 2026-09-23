CREATE TABLE "TaskMessage" (
  "id" TEXT NOT NULL,
  "taskId" INTEGER NOT NULL,
  "senderId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" INTEGER NOT NULL,
  CONSTRAINT "TaskMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskMessage_taskId_createdAt_idx" ON "TaskMessage"("taskId", "createdAt");
CREATE INDEX "TaskMessage_organizationId_idx" ON "TaskMessage"("organizationId");
ALTER TABLE "TaskMessage" ADD CONSTRAINT "TaskMessage_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskMessage" ADD CONSTRAINT "TaskMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskMessage" ADD CONSTRAINT "TaskMessage_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
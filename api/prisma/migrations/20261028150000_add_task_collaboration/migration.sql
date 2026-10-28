CREATE TABLE "TaskChecklistItem" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedById" INTEGER,
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaskChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskWatcher" (
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskWatcher_pkey" PRIMARY KEY ("taskId", "userId")
);

CREATE INDEX "TaskChecklistItem_taskId_sortOrder_idx" ON "TaskChecklistItem"("taskId", "sortOrder");
CREATE INDEX "TaskChecklistItem_organizationId_idx" ON "TaskChecklistItem"("organizationId");
CREATE INDEX "TaskWatcher_userId_createdAt_idx" ON "TaskWatcher"("userId", "createdAt");
CREATE INDEX "TaskWatcher_organizationId_idx" ON "TaskWatcher"("organizationId");

ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskWatcher" ADD CONSTRAINT "TaskWatcher_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskWatcher" ADD CONSTRAINT "TaskWatcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskWatcher" ADD CONSTRAINT "TaskWatcher_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

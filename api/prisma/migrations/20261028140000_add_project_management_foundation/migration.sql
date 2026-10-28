CREATE TABLE "ProjectMilestone" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskList" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaskList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskDependency" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "predecessorId" INTEGER NOT NULL,
    "successorId" INTEGER NOT NULL,
    "dependencyType" TEXT NOT NULL DEFAULT 'FINISH_TO_START',
    "lagDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectIssue" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "taskId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "severity" TEXT,
    "reportedById" INTEGER NOT NULL,
    "assignedToId" INTEGER,
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectIssue_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Task" ADD COLUMN "milestoneId" INTEGER;
ALTER TABLE "Task" ADD COLUMN "taskListId" INTEGER;

CREATE UNIQUE INDEX "TaskDependency_predecessorId_successorId_key" ON "TaskDependency"("predecessorId", "successorId");
CREATE INDEX "ProjectMilestone_projectId_sortOrder_idx" ON "ProjectMilestone"("projectId", "sortOrder");
CREATE INDEX "ProjectMilestone_organizationId_status_idx" ON "ProjectMilestone"("organizationId", "status");
CREATE INDEX "TaskList_projectId_sortOrder_idx" ON "TaskList"("projectId", "sortOrder");
CREATE INDEX "TaskList_organizationId_idx" ON "TaskList"("organizationId");
CREATE INDEX "TaskDependency_projectId_idx" ON "TaskDependency"("projectId");
CREATE INDEX "TaskDependency_organizationId_idx" ON "TaskDependency"("organizationId");
CREATE INDEX "ProjectIssue_projectId_status_priority_idx" ON "ProjectIssue"("projectId", "status", "priority");
CREATE INDEX "ProjectIssue_organizationId_status_idx" ON "ProjectIssue"("organizationId", "status");
CREATE INDEX "ProjectIssue_taskId_idx" ON "ProjectIssue"("taskId");
CREATE INDEX "Task_projectId_taskListId_milestoneId_idx" ON "Task"("projectId", "taskListId", "milestoneId");

ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskList" ADD CONSTRAINT "TaskList_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskList" ADD CONSTRAINT "TaskList_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectIssue" ADD CONSTRAINT "ProjectIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectIssue" ADD CONSTRAINT "ProjectIssue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectIssue" ADD CONSTRAINT "ProjectIssue_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectIssue" ADD CONSTRAINT "ProjectIssue_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectIssue" ADD CONSTRAINT "ProjectIssue_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_taskListId_fkey" FOREIGN KEY ("taskListId") REFERENCES "TaskList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

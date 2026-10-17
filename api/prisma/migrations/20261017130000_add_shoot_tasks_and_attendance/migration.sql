ALTER TABLE "Task"
ADD COLUMN "taskType" TEXT NOT NULL DEFAULT 'GENERAL',
ADD COLUMN "shootClientName" TEXT,
ADD COLUMN "shootLocation" TEXT,
ADD COLUMN "shootDate" DATE,
ADD COLUMN "shootReportingTime" TEXT,
ADD COLUMN "shootEstimatedHours" DOUBLE PRECISION;

CREATE INDEX "Task_taskType_shootDate_idx"
ON "Task"("taskType", "shootDate");

CREATE TABLE "TaskCrewAssignment" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskCrewAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskCrewAssignment_taskId_userId_key"
ON "TaskCrewAssignment"("taskId", "userId");

CREATE INDEX "TaskCrewAssignment_userId_taskId_idx"
ON "TaskCrewAssignment"("userId", "taskId");

ALTER TABLE "TaskCrewAssignment"
ADD CONSTRAINT "TaskCrewAssignment_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskCrewAssignment"
ADD CONSTRAINT "TaskCrewAssignment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attendance"
ADD COLUMN "isShootDay" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "LeaveRequest"
ADD COLUMN "requestType" TEXT NOT NULL DEFAULT 'LEAVE';

CREATE INDEX "LeaveRequest_organizationId_requestType_status_startDate_idx"
ON "LeaveRequest"("organizationId", "requestType", "status", "startDate");

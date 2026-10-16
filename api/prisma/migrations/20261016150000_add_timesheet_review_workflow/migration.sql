ALTER TABLE "Timesheet"
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedByUserId" INTEGER,
ADD COLUMN "rejectionReason" TEXT;

CREATE INDEX "Timesheet_reviewedByUserId_idx"
ON "Timesheet"("reviewedByUserId");

CREATE INDEX "Timesheet_organizationId_status_submittedAt_idx"
ON "Timesheet"("organizationId", "status", "submittedAt");

ALTER TABLE "Timesheet"
ADD CONSTRAINT "Timesheet_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

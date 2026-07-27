-- Projects module workflow upgrade
ALTER TABLE "Task"
ADD COLUMN IF NOT EXISTS "submissionLink" TEXT,
ADD COLUMN IF NOT EXISTS "reviewComment" TEXT;

-- Normalize legacy task statuses to workflow statuses
UPDATE "Task"
SET "status" = CASE
  WHEN UPPER("status") = 'NOT STARTED' THEN 'PENDING'
  WHEN UPPER("status") = 'IN PROGRESS' THEN 'IN_PROGRESS'
  WHEN UPPER("status") = 'COMPLETED' THEN 'APPROVED'
  ELSE UPPER("status")
END;

ALTER TABLE "Task"
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Normalize project statuses to ACTIVE/COMPLETED workflow
UPDATE "Project"
SET "status" = CASE
  WHEN UPPER("status") = 'COMPLETED' THEN 'COMPLETED'
  ELSE 'ACTIVE'
END;

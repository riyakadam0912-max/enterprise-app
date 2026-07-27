-- Repair drift for databases that are missing LeaveRequest.approvalTrail
ALTER TABLE "LeaveRequest"
  ADD COLUMN IF NOT EXISTS "approvalTrail" JSONB;
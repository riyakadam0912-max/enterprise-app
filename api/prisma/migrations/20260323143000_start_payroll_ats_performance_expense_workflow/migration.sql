-- Start payroll, ATS, performance, and expense approval workflow foundations

-- Expense workflow hardening
ALTER TABLE "Expense"
  ADD COLUMN IF NOT EXISTS "employeeId" INTEGER,
  ADD COLUMN IF NOT EXISTS "submittedByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "managerApprovalByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "hrApprovalByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "approvalTrail" JSONB;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_managerApprovalByUserId_fkey" FOREIGN KEY ("managerApprovalByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_hrApprovalByUserId_fkey" FOREIGN KEY ("hrApprovalByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Payroll models
CREATE TABLE "SalaryStructure" (
  "id" SERIAL NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "basic" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "hra" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "allowances" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pf" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "esi" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "professionalTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tds" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalaryStructure_employeeId_isActive_idx" ON "SalaryStructure"("employeeId", "isActive");
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PayrollCycle" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "runDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdBy" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PayrollCycle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollCycle_month_year_key" ON "PayrollCycle"("month", "year");

CREATE TABLE "PayrollEntry" (
  "id" SERIAL NOT NULL,
  "payrollCycleId" INTEGER NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "grossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollEntry_payrollCycleId_employeeId_key" ON "PayrollEntry"("payrollCycleId", "employeeId");
CREATE INDEX "PayrollEntry_employeeId_idx" ON "PayrollEntry"("employeeId");
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_payrollCycleId_fkey" FOREIGN KEY ("payrollCycleId") REFERENCES "PayrollCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ATS models
CREATE TABLE "JobOpening" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "department" TEXT,
  "location" TEXT,
  "employmentType" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "openings" INTEGER NOT NULL DEFAULT 1,
  "description" TEXT,
  "createdBy" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JobOpening_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Candidate" (
  "id" SERIAL NOT NULL,
  "jobOpeningId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "resumeUrl" TEXT,
  "source" TEXT,
  "currentStage" TEXT NOT NULL DEFAULT 'APPLIED',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Candidate_jobOpeningId_currentStage_idx" ON "Candidate"("jobOpeningId", "currentStage");
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "JobOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Interview" (
  "id" SERIAL NOT NULL,
  "candidateId" INTEGER NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "interviewerId" INTEGER,
  "mode" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "feedback" TEXT,
  "outcome" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Interview_candidateId_scheduledAt_idx" ON "Interview"("candidateId", "scheduledAt");
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Performance models
CREATE TABLE "GoalCycle" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdBy" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GoalCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Goal" (
  "id" SERIAL NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "goalCycleId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "weightage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "targetMetric" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "managerComment" TEXT,
  "employeeComment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Goal_employeeId_goalCycleId_idx" ON "Goal"("employeeId", "goalCycleId");
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_goalCycleId_fkey" FOREIGN KEY ("goalCycleId") REFERENCES "GoalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PerformanceReview" (
  "id" SERIAL NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "goalCycleId" INTEGER NOT NULL,
  "reviewerId" INTEGER,
  "rating" DOUBLE PRECISION,
  "summary" TEXT,
  "strengths" TEXT,
  "improvements" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PerformanceReview_employeeId_goalCycleId_key" ON "PerformanceReview"("employeeId", "goalCycleId");
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_goalCycleId_fkey" FOREIGN KEY ("goalCycleId") REFERENCES "GoalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

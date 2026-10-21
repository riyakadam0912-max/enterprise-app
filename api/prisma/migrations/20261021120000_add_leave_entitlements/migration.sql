CREATE TABLE "LeavePolicy" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "monthlyPaidLeave" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "taskHoursBonusThreshold" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "compOffMinimumHours" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "compOffExpiryDays" INTEGER NOT NULL DEFAULT 90,
    "firstAccrualMonth" DATE NOT NULL,
    "compOffEffectiveFrom" DATE NOT NULL,
    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

UPDATE "Employee"
SET "leaveBalance" = 0
WHERE "leaveBalance" IS NULL;
UPDATE "Employee"
SET "leaveBalance" = 0
WHERE "leaveBalance" < 0;

ALTER TABLE "Employee"
ALTER COLUMN "leaveBalance" SET DEFAULT 0,
ALTER COLUMN "leaveBalance" SET NOT NULL;

CREATE UNIQUE INDEX "LeavePolicy_organizationId_key"
ON "LeavePolicy"("organizationId");
CREATE INDEX "LeavePolicy_firstAccrualMonth_idx"
ON "LeavePolicy"("firstAccrualMonth");

ALTER TABLE "LeavePolicy"
ADD CONSTRAINT "LeavePolicy_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "LeavePolicy" (
    "organizationId",
    "firstAccrualMonth",
    "compOffEffectiveFrom"
)
SELECT
    organization."id",
    (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date,
    CURRENT_DATE
FROM "Organization" AS organization
WHERE organization."deletedAt" IS NULL;

CREATE TABLE "LeaveBalanceEntry" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceId" INTEGER,
    "description" TEXT,
    "periodStart" DATE,
    "periodEnd" DATE,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveBalanceEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaveBalanceEntry_sourceKey_key"
ON "LeaveBalanceEntry"("sourceKey");
CREATE INDEX "LeaveBalanceEntry_employeeId_category_createdAt_idx"
ON "LeaveBalanceEntry"("employeeId", "category", "createdAt");
CREATE INDEX "LeaveBalanceEntry_organizationId_category_createdAt_idx"
ON "LeaveBalanceEntry"("organizationId", "category", "createdAt");
CREATE INDEX "LeaveBalanceEntry_category_expiresAt_idx"
ON "LeaveBalanceEntry"("category", "expiresAt");

ALTER TABLE "LeaveBalanceEntry"
ADD CONSTRAINT "LeaveBalanceEntry_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveBalanceEntry"
ADD CONSTRAINT "LeaveBalanceEntry_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LeaveCompOffClaim" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "workDate" DATE NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeaveCompOffClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaveCompOffClaim_employeeId_workDate_key"
ON "LeaveCompOffClaim"("employeeId", "workDate");
CREATE INDEX "LeaveCompOffClaim_organizationId_status_createdAt_idx"
ON "LeaveCompOffClaim"("organizationId", "status", "createdAt");
CREATE INDEX "LeaveCompOffClaim_employeeId_status_idx"
ON "LeaveCompOffClaim"("employeeId", "status");

ALTER TABLE "LeaveCompOffClaim"
ADD CONSTRAINT "LeaveCompOffClaim_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveCompOffClaim"
ADD CONSTRAINT "LeaveCompOffClaim_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "LeaveBalanceEntry" (
    "employeeId",
    "organizationId",
    "category",
    "entryType",
    "amount",
    "sourceKey",
    "description"
)
SELECT
    employee."id",
    employee."organizationId",
    'PAID_LEAVE',
    'OPENING_BALANCE',
    employee."leaveBalance",
    'opening-balance:' || employee."id"::text,
    'Migrated from Employee.leaveBalance'
FROM "Employee" AS employee
WHERE employee."leaveBalance" > 0
  AND employee."deletedAt" IS NULL;

DROP INDEX IF EXISTS "PayrollCycle_month_year_key";

CREATE UNIQUE INDEX "PayrollCycle_organizationId_month_year_key"
  ON "PayrollCycle"("organizationId", "month", "year");

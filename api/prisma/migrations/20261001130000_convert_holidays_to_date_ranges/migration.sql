ALTER TABLE "Holiday"
  ADD COLUMN "startDate" DATE,
  ADD COLUMN "endDate" DATE;

UPDATE "Holiday"
SET "startDate" = "date",
    "endDate" = "date";

DROP INDEX "Holiday_organizationId_date_key";
DROP INDEX "Holiday_organizationId_date_idx";

ALTER TABLE "Holiday"
  ALTER COLUMN "startDate" SET NOT NULL,
  ALTER COLUMN "endDate" SET NOT NULL,
  DROP COLUMN "date";

CREATE INDEX "Holiday_organizationId_startDate_endDate_idx"
  ON "Holiday"("organizationId", "startDate", "endDate");
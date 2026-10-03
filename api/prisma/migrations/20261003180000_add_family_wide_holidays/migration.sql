ALTER TABLE "Holiday"
ADD COLUMN "familyRootOrganizationId" INTEGER;

ALTER TABLE "Holiday"
ADD CONSTRAINT "Holiday_familyRootOrganizationId_fkey"
FOREIGN KEY ("familyRootOrganizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Holiday_familyRootOrganizationId_startDate_endDate_idx"
ON "Holiday"("familyRootOrganizationId", "startDate", "endDate");

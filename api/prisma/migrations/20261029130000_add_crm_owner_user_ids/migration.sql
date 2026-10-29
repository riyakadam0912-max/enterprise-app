ALTER TABLE "Lead"
  ADD COLUMN "ownerUserId" INTEGER;

ALTER TABLE "Deal"
  ADD COLUMN "ownerUserId" INTEGER;

UPDATE "Lead" l
SET "ownerUserId" = u.id
FROM "Employee" e
JOIN "User" u ON u."employeeId" = e.id
WHERE l."assignedToId" = e.id
  AND l."organizationId" = u."organizationId"
  AND l."ownerUserId" IS NULL;

UPDATE "Deal" d
SET "ownerUserId" = u.id
FROM "Employee" e
JOIN "User" u ON u."employeeId" = e.id
WHERE d."assignedToId" = e.id
  AND d."organizationId" = u."organizationId"
  AND d."ownerUserId" IS NULL;

CREATE INDEX "Lead_organizationId_ownerUserId_idx"
  ON "Lead"("organizationId", "ownerUserId");
CREATE INDEX "Deal_organizationId_ownerUserId_idx"
  ON "Deal"("organizationId", "ownerUserId");

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Deal"
  ADD CONSTRAINT "Deal_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

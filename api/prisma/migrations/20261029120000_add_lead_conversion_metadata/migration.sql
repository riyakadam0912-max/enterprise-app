ALTER TABLE "Lead"
  ADD COLUMN "convertedAt" TIMESTAMP(3),
  ADD COLUMN "convertedById" INTEGER,
  ADD COLUMN "convertedContactId" INTEGER,
  ADD COLUMN "convertedCustomerId" INTEGER,
  ADD COLUMN "convertedDealId" INTEGER;

CREATE UNIQUE INDEX "Lead_convertedDealId_key" ON "Lead"("convertedDealId");
CREATE INDEX "Lead_organizationId_convertedAt_idx" ON "Lead"("organizationId", "convertedAt");

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_convertedById_fkey"
  FOREIGN KEY ("convertedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Lead_convertedContactId_fkey"
  FOREIGN KEY ("convertedContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Lead_convertedCustomerId_fkey"
  FOREIGN KEY ("convertedCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Lead_convertedDealId_fkey"
  FOREIGN KEY ("convertedDealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

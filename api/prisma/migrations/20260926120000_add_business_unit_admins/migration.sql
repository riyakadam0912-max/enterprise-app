CREATE TABLE "BusinessUnitAdmin" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "businessUnitId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessUnitAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessUnitAdmin_userId_businessUnitId_key"
    ON "BusinessUnitAdmin"("userId", "businessUnitId");
CREATE INDEX "BusinessUnitAdmin_organizationId_businessUnitId_idx"
    ON "BusinessUnitAdmin"("organizationId", "businessUnitId");
CREATE INDEX "BusinessUnitAdmin_userId_organizationId_idx"
    ON "BusinessUnitAdmin"("userId", "organizationId");

ALTER TABLE "BusinessUnitAdmin"
    ADD CONSTRAINT "BusinessUnitAdmin_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessUnitAdmin"
    ADD CONSTRAINT "BusinessUnitAdmin_businessUnitId_fkey"
    FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessUnitAdmin"
    ADD CONSTRAINT "BusinessUnitAdmin_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

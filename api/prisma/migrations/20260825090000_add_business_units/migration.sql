CREATE TYPE "BusinessUnitStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

CREATE TABLE "BusinessUnit" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT,
    "status" "BusinessUnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN "primaryBusinessUnitId" INTEGER;
ALTER TABLE "Employee" ADD COLUMN "businessUnitId" INTEGER;

CREATE UNIQUE INDEX "BusinessUnit_organizationId_code_key" ON "BusinessUnit"("organizationId", "code");
CREATE INDEX "BusinessUnit_organizationId_idx" ON "BusinessUnit"("organizationId");
CREATE INDEX "BusinessUnit_parentId_idx" ON "BusinessUnit"("parentId");
CREATE INDEX "User_primaryBusinessUnitId_idx" ON "User"("primaryBusinessUnitId");
CREATE INDEX "Employee_businessUnitId_idx" ON "Employee"("businessUnitId");

ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_primaryBusinessUnitId_fkey" FOREIGN KEY ("primaryBusinessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

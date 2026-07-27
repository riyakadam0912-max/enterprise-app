-- Step 1: Ensure we have at least one Organization (create a default one if none exists)
INSERT INTO "Organization" ("name", "code", "slug", "timezone", "currency", "status", "createdAt", "updatedAt")
SELECT 
  'Default Organization' AS "name", 
  'DEFAULT' AS "code", 
  'default' AS "slug", 
  'UTC' AS "timezone", 
  'USD' AS "currency", 
  'ACTIVE'::"OrganizationStatus" AS "status", 
  NOW() AS "createdAt", 
  NOW() AS "updatedAt"
WHERE NOT EXISTS (SELECT 1 FROM "Organization" LIMIT 1);

-- Step 2: Add organizationId as nullable column
ALTER TABLE "Employee" ADD COLUMN "organizationId" INTEGER;

-- Step 3: Update all employees to point to the default organization
UPDATE "Employee" 
SET "organizationId" = (SELECT id FROM "Organization" LIMIT 1);

-- Step 4: Make organizationId NOT NULL
ALTER TABLE "Employee" ALTER COLUMN "organizationId" SET NOT NULL;

-- Step 5: Add index
CREATE INDEX "Employee_organizationId_idx" ON "Employee"("organizationId");

-- Step 6: Add foreign key constraint
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

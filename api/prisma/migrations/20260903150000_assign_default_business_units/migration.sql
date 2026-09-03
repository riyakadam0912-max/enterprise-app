-- Ensure every organization has an active Business Unit for scoped records.
UPDATE "BusinessUnit" AS target
SET "status" = 'ACTIVE', "updatedAt" = CURRENT_TIMESTAMP
WHERE target."id" = (
  SELECT candidate."id"
  FROM "BusinessUnit" AS candidate
  WHERE candidate."organizationId" = target."organizationId"
    AND candidate."status" <> 'ACTIVE'
  ORDER BY candidate."id"
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1
  FROM "BusinessUnit" AS active
  WHERE active."organizationId" = target."organizationId"
    AND active."status" = 'ACTIVE'
);

INSERT INTO "BusinessUnit" (
  "organizationId", "name", "code", "description", "type", "status", "updatedAt"
)
SELECT
  organization."id",
  'General',
  'GENERAL',
  'Default Business Unit for legacy records',
  'GENERAL',
  'ACTIVE',
  CURRENT_TIMESTAMP
FROM "Organization" AS organization
WHERE NOT EXISTS (
  SELECT 1
  FROM "BusinessUnit" AS existing
  WHERE existing."organizationId" = organization."id"
);

-- Prefer an employee's valid linked user assignment, then the organization's
-- first active unit. This keeps legacy data in its tenant and in a real scope.
UPDATE "Employee" AS employee
SET "businessUnitId" = COALESCE(
  (
    SELECT "User"."primaryBusinessUnitId"
    FROM "User"
    JOIN "BusinessUnit" AS linked_unit
      ON linked_unit."id" = "User"."primaryBusinessUnitId"
     AND linked_unit."organizationId" = employee."organizationId"
     AND linked_unit."status" = 'ACTIVE'
    WHERE "User"."employeeId" = employee."id"
    ORDER BY "User"."id"
    LIMIT 1
  ),
  (
    SELECT unit."id"
    FROM "BusinessUnit" AS unit
    WHERE unit."organizationId" = employee."organizationId"
      AND unit."status" = 'ACTIVE'
    ORDER BY unit."id"
    LIMIT 1
  )
)
WHERE employee."businessUnitId" IS NULL
  AND employee."deletedAt" IS NULL;

-- Align linked users with their employee's repaired assignment. For remaining
-- organization users, use the first active unit in their organization.
UPDATE "User" AS user_record
SET "primaryBusinessUnitId" = COALESCE(
  (
    SELECT employee."businessUnitId"
    FROM "Employee" AS employee
    WHERE employee."id" = user_record."employeeId"
      AND employee."organizationId" = user_record."organizationId"
      AND employee."businessUnitId" IS NOT NULL
  ),
  (
    SELECT unit."id"
    FROM "BusinessUnit" AS unit
    WHERE unit."organizationId" = user_record."organizationId"
      AND unit."status" = 'ACTIVE'
    ORDER BY unit."id"
    LIMIT 1
  )
)
WHERE user_record."organizationId" IS NOT NULL
  AND (
    user_record."primaryBusinessUnitId" IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM "BusinessUnit" AS current_unit
      WHERE current_unit."id" = user_record."primaryBusinessUnitId"
        AND current_unit."organizationId" = user_record."organizationId"
        AND current_unit."status" = 'ACTIVE'
    )
  );

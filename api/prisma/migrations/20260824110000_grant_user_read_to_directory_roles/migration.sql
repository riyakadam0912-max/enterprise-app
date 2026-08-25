-- Allow directory read access while keeping write permissions unchanged.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "AppRole" role
CROSS JOIN "Permission" permission
WHERE role."name" IN ('HR', 'MANAGER', 'EMPLOYEE')
  AND permission."key" = 'user.read'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
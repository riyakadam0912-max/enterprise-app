INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "AppRole" AS role
CROSS JOIN "Permission" AS permission
WHERE role."name" IN ('HR', 'MANAGER')
  AND permission."key" = 'customer.read'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
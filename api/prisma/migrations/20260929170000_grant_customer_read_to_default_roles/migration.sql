INSERT INTO "Permission" ("key", "description")
VALUES ('customer.read', 'Permission for customer.read')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "AppRole" AS role
CROSS JOIN "Permission" AS permission
WHERE role."name" IN ('ADMIN', 'MANAGER', 'EMPLOYEE')
  AND permission."key" = 'customer.read'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
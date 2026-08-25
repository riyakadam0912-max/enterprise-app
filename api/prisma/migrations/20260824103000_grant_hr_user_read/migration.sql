-- Grant HR the permission required by the user-management read endpoint.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "AppRole" role
CROSS JOIN "Permission" permission
WHERE role."name" = 'HR'
  AND permission."key" = 'user.read'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
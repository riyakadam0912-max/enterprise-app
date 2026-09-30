WITH matching_assignments AS (
    SELECT DISTINCT ON (project."id")
        project."id" AS "projectId",
        notification."createdBy" AS "assignedById"
    FROM "Project" AS project
    JOIN "User" AS manager
        ON manager."id" = project."managerId"
    JOIN "Notification" AS notification
        ON notification."organizationId" = project."organizationId"
        AND notification."entityType" = 'Project'
        AND notification."entityId" = project."id"
        AND notification."createdBy" IS NOT NULL
        AND notification."message" = 'Project manager changed to ' || manager."name" || '.'
    WHERE project."managerAssignedById" IS NULL
            AND (
                    SELECT COUNT(*)
                    FROM "User" AS same_name_manager
                    WHERE same_name_manager."organizationId" = project."organizationId"
                        AND same_name_manager."name" = manager."name"
            ) = 1
    ORDER BY project."id", notification."createdAt" DESC, notification."id" DESC
)
UPDATE "Project" AS project
SET "managerAssignedById" = matching_assignments."assignedById"
FROM matching_assignments
WHERE project."id" = matching_assignments."projectId"
  AND project."managerAssignedById" IS NULL;
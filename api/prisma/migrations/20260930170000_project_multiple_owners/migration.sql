CREATE TABLE "_ProjectOwners" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

CREATE UNIQUE INDEX "_ProjectOwners_AB_unique" ON "_ProjectOwners"("A", "B");
CREATE INDEX "_ProjectOwners_B_index" ON "_ProjectOwners"("B");

INSERT INTO "_ProjectOwners" ("A", "B")
SELECT "id", "createdById"
FROM "Project"
WHERE "createdById" IS NOT NULL
UNION
SELECT "id", "ownerId"
FROM "Project"
WHERE "ownerId" IS NOT NULL
ON CONFLICT ("A", "B") DO NOTHING;

ALTER TABLE "_ProjectOwners"
ADD CONSTRAINT "_ProjectOwners_A_fkey"
FOREIGN KEY ("A") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_ProjectOwners"
ADD CONSTRAINT "_ProjectOwners_B_fkey"
FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "Project_ownerId_idx";
ALTER TABLE "Project" DROP CONSTRAINT "Project_ownerId_fkey";
ALTER TABLE "Project" DROP COLUMN "ownerId";
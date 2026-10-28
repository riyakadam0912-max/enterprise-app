CREATE TABLE "ProjectBaseline" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectBaseline_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectBaseline_projectId_snapshotAt_idx" ON "ProjectBaseline"("projectId", "snapshotAt");
CREATE INDEX "ProjectBaseline_organizationId_idx" ON "ProjectBaseline"("organizationId");

ALTER TABLE "ProjectBaseline" ADD CONSTRAINT "ProjectBaseline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectBaseline" ADD CONSTRAINT "ProjectBaseline_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectBaseline" ADD CONSTRAINT "ProjectBaseline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

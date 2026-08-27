-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "parentId" INTEGER;

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT,
    "description" TEXT,
    "updatedBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "SystemSetting_updatedBy_idx" ON "SystemSetting"("updatedBy");

-- CreateIndex
CREATE INDEX "Organization_parentId_idx" ON "Organization"("parentId");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

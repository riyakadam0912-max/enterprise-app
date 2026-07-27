DO $$ BEGIN
	CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE', 'CANCELLED');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Organization" (
	"id" SERIAL NOT NULL,
	"name" TEXT NOT NULL,
	"code" TEXT NOT NULL,
	"slug" TEXT NOT NULL,
	"email" TEXT,
	"phone" TEXT,
	"logoUrl" TEXT,
	"address" TEXT,
	"city" TEXT,
	"state" TEXT,
	"country" TEXT,
	"postalCode" TEXT,
	"timezone" TEXT NOT NULL DEFAULT 'UTC',
	"currency" TEXT NOT NULL DEFAULT 'USD',
	"status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
	"website" TEXT,
	"gstNumber" TEXT,
	"panNumber" TEXT,
	"taxId" TEXT,
	"industry" TEXT,
	"employeeLimit" INTEGER,
	"subscriptionPlan" TEXT,
	"billingEmail" TEXT,
	"billingAddress" TEXT,
	"contactPerson" TEXT,
	"contactPhone" TEXT,
	"contactEmail" TEXT,
	"trialStartDate" TIMESTAMP(3),
	"trialEndDate" TIMESTAMP(3),
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,
	"deletedAt" TIMESTAMP(3),

	CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Organization_status_idx" ON "Organization"("status");
CREATE INDEX "Organization_createdAt_idx" ON "Organization"("createdAt");
CREATE INDEX "Organization_subscriptionPlan_idx" ON "Organization"("subscriptionPlan");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "organizationId" INTEGER;

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

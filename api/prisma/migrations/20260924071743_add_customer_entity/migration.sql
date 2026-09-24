-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('BUSINESS', 'INDIVIDUAL');

-- AlterTable
ALTER TABLE "ClientProfile" ADD COLUMN     "customerId" INTEGER,
ALTER COLUMN "contactId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "customerId" INTEGER;

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerType" "CustomerType" NOT NULL DEFAULT 'BUSINESS',
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "webAddress" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- Backfill Customer records from the legacy Contact table before enabling new relations.
INSERT INTO "Customer" (
        "organizationId", "customerName", "customerType", "addressLine1", "city", "state", "country", "zipCode", "webAddress", "email", "phoneNumber", "createdAt", "updatedAt"
)
SELECT
        "organizationId",
        "contactName",
        'BUSINESS'::"CustomerType",
        COALESCE(NULLIF("address", ''), 'Not provided'),
        'Not provided',
        'Not provided',
        'Not provided',
        'Not provided',
        "website",
        "email",
        "phoneNumber",
        "createdAt",
        "updatedAt"
FROM "Contact"
WHERE "deletedAt" IS NULL;

UPDATE "ClientProfile" AS profile
SET "customerId" = customer.id
FROM "Contact" AS contact
JOIN "Customer" AS customer
    ON customer."organizationId" = contact."organizationId"
 AND customer."customerName" = contact."contactName"
WHERE profile."contactId" = contact."id"
    AND profile."customerId" IS NULL;

UPDATE "Project" AS project
SET "customerId" = customer.id
FROM "Customer" AS customer
WHERE project."organizationId" = customer."organizationId"
    AND (project."clientName" = customer."customerName" OR project."client" = customer."customerName")
    AND project."customerId" IS NULL;

-- CreateIndex
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");

-- CreateIndex
CREATE INDEX "Customer_customerName_idx" ON "Customer"("customerName");

-- CreateIndex
CREATE INDEX "Customer_status_idx" ON "Customer"("status");

-- CreateIndex
CREATE INDEX "ClientProfile_customerId_idx" ON "ClientProfile"("customerId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

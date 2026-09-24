-- CreateEnum
CREATE TYPE "ClientProfileStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ClientAccessStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CLIENT';

-- CreateTable
CREATE TABLE "ClientProfile" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "status" "ClientProfileStatus" NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientProjectAccess" (
    "clientProfileId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "accessStatus" "ClientAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "canViewOverview" BOOLEAN NOT NULL DEFAULT true,
    "canViewTasks" BOOLEAN NOT NULL DEFAULT false,
    "canViewFiles" BOOLEAN NOT NULL DEFAULT true,
    "canViewMessages" BOOLEAN NOT NULL DEFAULT true,
    "canViewInvoices" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ClientProjectAccess_pkey" PRIMARY KEY ("clientProfileId","projectId")
);

-- CreateTable
CREATE TABLE "ClientInvitation" (
    "id" SERIAL NOT NULL,
    "clientProfileId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'client-invitation',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientProfile_userId_key" ON "ClientProfile"("userId");

-- CreateIndex
CREATE INDEX "ClientProfile_organizationId_idx" ON "ClientProfile"("organizationId");

-- CreateIndex
CREATE INDEX "ClientProfile_contactId_idx" ON "ClientProfile"("contactId");

-- CreateIndex
CREATE INDEX "ClientProfile_status_idx" ON "ClientProfile"("status");

-- CreateIndex
CREATE INDEX "ClientProjectAccess_projectId_idx" ON "ClientProjectAccess"("projectId");

-- CreateIndex
CREATE INDEX "ClientProjectAccess_accessStatus_idx" ON "ClientProjectAccess"("accessStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvitation_tokenHash_key" ON "ClientInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "ClientInvitation_clientProfileId_idx" ON "ClientInvitation"("clientProfileId");

-- CreateIndex
CREATE INDEX "ClientInvitation_organizationId_idx" ON "ClientInvitation"("organizationId");

-- CreateIndex
CREATE INDEX "ClientInvitation_expiresAt_idx" ON "ClientInvitation"("expiresAt");

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProjectAccess" ADD CONSTRAINT "ClientProjectAccess_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProjectAccess" ADD CONSTRAINT "ClientProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvitation" ADD CONSTRAINT "ClientInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvitation" ADD CONSTRAINT "ClientInvitation_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CampaignLead" (
    "id" SERIAL NOT NULL,
    "campaign" TEXT NOT NULL,
    "engagementScore" INTEGER,
    "sourceType" TEXT,
    "lastInteraction" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "leadId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignLead_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CampaignLead" ADD CONSTRAINT "CampaignLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

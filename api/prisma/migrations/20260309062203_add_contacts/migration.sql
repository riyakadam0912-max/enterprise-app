-- CreateTable
CREATE TABLE "Contact" (
    "id" SERIAL NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "leadSource" TEXT,
    "address" TEXT,
    "website" TEXT,
    "linkedin" TEXT,
    "contactStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

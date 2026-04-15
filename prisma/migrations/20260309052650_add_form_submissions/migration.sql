-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" SERIAL NOT NULL,
    "form" TEXT NOT NULL,
    "submittedBy" TEXT,
    "submissionDate" TIMESTAMP(3),
    "data" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "reviewer" TEXT,
    "reviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

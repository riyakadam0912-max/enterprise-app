-- CreateTable
CREATE TABLE "DynamicForm" (
    "id" SERIAL NOT NULL,
    "formName" TEXT NOT NULL,
    "formCode" TEXT,
    "description" TEXT,
    "createdBy" TEXT,
    "status" TEXT,
    "formType" TEXT,
    "targetModule" TEXT,
    "createdOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DynamicForm_pkey" PRIMARY KEY ("id")
);

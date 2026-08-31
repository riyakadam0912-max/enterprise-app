CREATE TABLE "UserReportingManager" (
    "employeeId" INTEGER NOT NULL,
    "managerId" INTEGER NOT NULL,

    CONSTRAINT "UserReportingManager_pkey" PRIMARY KEY ("employeeId", "managerId")
);

CREATE INDEX "UserReportingManager_managerId_idx" ON "UserReportingManager"("managerId");

ALTER TABLE "UserReportingManager" ADD CONSTRAINT "UserReportingManager_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserReportingManager" ADD CONSTRAINT "UserReportingManager_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

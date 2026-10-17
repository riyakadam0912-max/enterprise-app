CREATE TABLE "EmployeeShiftAssignment" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeShiftAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeShiftAssignment_employeeId_effectiveFrom_effectiveT_idx"
ON "EmployeeShiftAssignment"("employeeId", "effectiveFrom", "effectiveTo");

CREATE INDEX "EmployeeShiftAssignment_shiftId_idx"
ON "EmployeeShiftAssignment"("shiftId");

ALTER TABLE "EmployeeShiftAssignment"
ADD CONSTRAINT "EmployeeShiftAssignment_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeShiftAssignment"
ADD CONSTRAINT "EmployeeShiftAssignment_shiftId_fkey"
FOREIGN KEY ("shiftId") REFERENCES "Shift"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "EmployeeShiftAssignment" ("employeeId", "shiftId", "effectiveFrom")
SELECT e."id", e."shiftId",
       COALESCE(MIN(a."date"), e."hireDate", e."createdAt")
FROM "Employee" e
LEFT JOIN "Attendance" a
  ON a."employeeId" = e."id"
 AND a."shiftId" = e."shiftId"
WHERE e."shiftId" IS NOT NULL
GROUP BY e."id", e."shiftId", e."hireDate", e."createdAt";

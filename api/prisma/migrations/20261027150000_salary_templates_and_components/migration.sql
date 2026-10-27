ALTER TABLE "SalaryStructure"
ADD COLUMN "templateId" INTEGER,
ADD COLUMN "annualCtc" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "effectiveTo" TIMESTAMP(3),
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "manualPf" DOUBLE PRECISION,
ADD COLUMN "manualEsi" DOUBLE PRECISION,
ADD COLUMN "manualProfessionalTax" DOUBLE PRECISION,
ADD COLUMN "manualTds" DOUBLE PRECISION,
ADD COLUMN "manualOtherDeductions" DOUBLE PRECISION;

CREATE TABLE "SalaryTemplate" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "annualCtc" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SalaryTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalaryTemplateComponent" (
  "id" SERIAL NOT NULL,
  "templateId" INTEGER NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "payslipName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "calculationType" TEXT NOT NULL DEFAULT 'FIXED',
  "calculationValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "monthlyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "annualAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "taxable" BOOLEAN NOT NULL DEFAULT true,
  "prorated" BOOLEAN NOT NULL DEFAULT true,
  "includedInCtc" BOOLEAN NOT NULL DEFAULT true,
  "showInPayslip" BOOLEAN NOT NULL DEFAULT true,
  "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalaryTemplateComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalaryStructureComponent" (
  "id" SERIAL NOT NULL,
  "salaryStructureId" INTEGER NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "payslipName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "calculationType" TEXT NOT NULL DEFAULT 'FIXED',
  "calculationValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "monthlyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "annualAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "taxable" BOOLEAN NOT NULL DEFAULT true,
  "prorated" BOOLEAN NOT NULL DEFAULT true,
  "includedInCtc" BOOLEAN NOT NULL DEFAULT true,
  "showInPayslip" BOOLEAN NOT NULL DEFAULT true,
  "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalaryStructureComponent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalaryTemplate_organizationId_name_key" ON "SalaryTemplate"("organizationId", "name");
CREATE INDEX "SalaryTemplate_organizationId_isActive_idx" ON "SalaryTemplate"("organizationId", "isActive");
CREATE UNIQUE INDEX "SalaryTemplateComponent_templateId_code_key" ON "SalaryTemplateComponent"("templateId", "code");
CREATE INDEX "SalaryTemplateComponent_organizationId_idx" ON "SalaryTemplateComponent"("organizationId");
CREATE UNIQUE INDEX "SalaryStructureComponent_salaryStructureId_code_key" ON "SalaryStructureComponent"("salaryStructureId", "code");
CREATE INDEX "SalaryStructureComponent_organizationId_idx" ON "SalaryStructureComponent"("organizationId");
CREATE INDEX "SalaryStructure_templateId_idx" ON "SalaryStructure"("templateId");
CREATE INDEX "SalaryStructure_employeeId_effectiveFrom_effectiveTo_idx" ON "SalaryStructure"("employeeId", "effectiveFrom", "effectiveTo");

ALTER TABLE "SalaryTemplate" ADD CONSTRAINT "SalaryTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalaryTemplateComponent" ADD CONSTRAINT "SalaryTemplateComponent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SalaryTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalaryTemplateComponent" ADD CONSTRAINT "SalaryTemplateComponent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalaryStructureComponent" ADD CONSTRAINT "SalaryStructureComponent_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalaryStructureComponent" ADD CONSTRAINT "SalaryStructureComponent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SalaryTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

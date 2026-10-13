ALTER TABLE "Invoice" ADD COLUMN "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "name" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "customerId" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "customerAddress" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "discountType" TEXT NOT NULL DEFAULT 'AMOUNT';
ALTER TABLE "Invoice" ADD COLUMN "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "termsAndConditions" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "templateKey" TEXT NOT NULL DEFAULT 'minimal';
ALTER TABLE "Invoice" ADD COLUMN "adjustmentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "adjustmentType" TEXT NOT NULL DEFAULT 'AMOUNT';
ALTER TABLE "Invoice" ADD COLUMN "adjustmentRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "tdsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invoice" ADD COLUMN "tdsRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "tdsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "tcsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invoice" ADD COLUMN "tcsRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "tcsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "Invoice"
SET "subtotal" = GREATEST(0, "totalAmount" - "taxAmount" + "discount");

CREATE TABLE "InvoiceItem" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "productId" INTEGER,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'Unit',
    "type" TEXT NOT NULL DEFAULT 'SERVICE',
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "InvoiceItem_organizationId_idx" ON "InvoiceItem"("organizationId");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "QuotePublicLink" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMP(3),
    CONSTRAINT "QuotePublicLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteStatusHistory" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SYSTEM',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuotePublicLink_quoteId_key" ON "QuotePublicLink"("quoteId");
CREATE UNIQUE INDEX "QuotePublicLink_tokenHash_key" ON "QuotePublicLink"("tokenHash");
CREATE INDEX "QuotePublicLink_expiresAt_idx" ON "QuotePublicLink"("expiresAt");
CREATE INDEX "QuoteStatusHistory_quoteId_createdAt_idx" ON "QuoteStatusHistory"("quoteId", "createdAt");

ALTER TABLE "QuotePublicLink" ADD CONSTRAINT "QuotePublicLink_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteStatusHistory" ADD CONSTRAINT "QuoteStatusHistory_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
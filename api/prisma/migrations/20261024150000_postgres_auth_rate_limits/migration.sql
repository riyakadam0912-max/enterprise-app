CREATE TABLE "AuthRateLimitBucket" (
  "key" TEXT NOT NULL,
  "hits" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "blockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthRateLimitBucket_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "AuthRateLimitBucket_expiresAt_idx" ON "AuthRateLimitBucket"("expiresAt");

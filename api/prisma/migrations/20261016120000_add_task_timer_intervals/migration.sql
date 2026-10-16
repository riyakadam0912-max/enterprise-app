CREATE TABLE "TaskTimerInterval" (
    "id" SERIAL NOT NULL,
    "timerSessionId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaskTimerInterval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskTimerInterval_timerSessionId_startedAt_idx"
ON "TaskTimerInterval"("timerSessionId", "startedAt");

CREATE INDEX "TaskTimerInterval_startedAt_endedAt_idx"
ON "TaskTimerInterval"("startedAt", "endedAt");

ALTER TABLE "TaskTimerInterval"
ADD CONSTRAINT "TaskTimerInterval_timerSessionId_fkey"
FOREIGN KEY ("timerSessionId") REFERENCES "TaskTimerSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ActivityTimeline" (
    "id"              SERIAL         NOT NULL,
    "module"          TEXT           NOT NULL,
    "entityType"      TEXT           NOT NULL,
    "entityId"        INTEGER        NOT NULL,
    "eventType"       TEXT           NOT NULL,
    "action"          TEXT           NOT NULL,
    "title"           TEXT           NOT NULL,
    "description"     TEXT,
    "oldValue"        JSONB,
    "newValue"        JSONB,
    "metadata"        JSONB,
    "performedBy"     INTEGER,
    "performedByRole" TEXT,
    "assignedTo"      INTEGER,
    "status"          TEXT           NOT NULL DEFAULT 'OPEN',
    "priority"        TEXT           NOT NULL DEFAULT 'MEDIUM',
    "icon"            TEXT,
    "color"           TEXT,
    "ipAddress"       TEXT,
    "deviceInfo"      TEXT,
    "attachments"     JSONB,
    "workflowStage"   TEXT,
    "approvalStatus"  TEXT,
    "createdAt"       TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "ActivityTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityTimelineComment" (
    "id"              SERIAL       NOT NULL,
    "timelineId"      INTEGER      NOT NULL,
    "userId"          INTEGER,
    "userRole"        TEXT,
    "comment"         TEXT         NOT NULL,
    "parentCommentId" INTEGER,
    "mentions"        JSONB,
    "isInternal"      BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityTimelineComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityTimeline_entityType_entityId_idx" ON "ActivityTimeline"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityTimeline_module_idx" ON "ActivityTimeline"("module");

-- CreateIndex
CREATE INDEX "ActivityTimeline_eventType_idx" ON "ActivityTimeline"("eventType");

-- CreateIndex
CREATE INDEX "ActivityTimeline_performedBy_idx" ON "ActivityTimeline"("performedBy");

-- CreateIndex
CREATE INDEX "ActivityTimeline_assignedTo_idx" ON "ActivityTimeline"("assignedTo");

-- CreateIndex
CREATE INDEX "ActivityTimeline_createdAt_idx" ON "ActivityTimeline"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityTimelineComment_timelineId_idx" ON "ActivityTimelineComment"("timelineId");

-- CreateIndex
CREATE INDEX "ActivityTimelineComment_userId_idx" ON "ActivityTimelineComment"("userId");

-- AddForeignKey
ALTER TABLE "ActivityTimelineComment"
    ADD CONSTRAINT "ActivityTimelineComment_timelineId_fkey"
    FOREIGN KEY ("timelineId")
    REFERENCES "ActivityTimeline"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

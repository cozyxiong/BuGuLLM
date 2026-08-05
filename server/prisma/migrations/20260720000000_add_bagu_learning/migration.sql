-- CreateTable: feishu_docs
CREATE TABLE "feishu_docs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "embedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feishu_docs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "feishu_docs_workspaceId_idx" ON "feishu_docs"("workspaceId");

-- CreateTable: learning_items
CREATE TABLE "learning_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" INTEGER NOT NULL,
    "itemType" TEXT NOT NULL,
    "sourceFileId" INTEGER,
    "sourceChunkId" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "reviewState" TEXT NOT NULL DEFAULT 'new',
    "easeFactor" REAL NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" DATETIME,
    "lastReviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "learning_items_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "learning_items_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "library_files" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "learning_items_workspaceId_itemType_idx" ON "learning_items"("workspaceId", "itemType");
CREATE INDEX "learning_items_workspaceId_reviewState_idx" ON "learning_items"("workspaceId", "reviewState");
CREATE INDEX "learning_items_reviewState_nextReviewAt_idx" ON "learning_items"("reviewState", "nextReviewAt");

-- CreateTable: review_events
CREATE TABLE "review_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "learningItemId" INTEGER NOT NULL,
    "rating" TEXT NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_events_learningItemId_fkey" FOREIGN KEY ("learningItemId") REFERENCES "learning_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "review_events_learningItemId_idx" ON "review_events"("learningItemId");

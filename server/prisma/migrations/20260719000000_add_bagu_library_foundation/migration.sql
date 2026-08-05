-- CreateTable
CREATE TABLE "libraries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rootPath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "libraries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "library_files" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "libraryId" INTEGER NOT NULL,
    "relativePath" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "extension" TEXT,
    "size" INTEGER NOT NULL DEFAULT 0,
    "sourceType" TEXT NOT NULL DEFAULT 'vault',
    "indexStatus" TEXT NOT NULL DEFAULT 'pending',
    "indexedDocumentId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "library_files_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tags" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "library_file_tags" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "libraryFileId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "library_file_tags_libraryFileId_fkey" FOREIGN KEY ("libraryFileId") REFERENCES "library_files" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "library_file_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "libraries_workspaceId_key" ON "libraries"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "libraries_rootPath_key" ON "libraries"("rootPath");

-- CreateIndex
CREATE UNIQUE INDEX "library_files_libraryId_relativePath_key" ON "library_files"("libraryId", "relativePath");

-- CreateIndex
CREATE INDEX "library_files_libraryId_indexStatus_idx" ON "library_files"("libraryId", "indexStatus");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "library_file_tags_libraryFileId_tagId_key" ON "library_file_tags"("libraryFileId", "tagId");

-- CreateIndex
CREATE INDEX "library_file_tags_tagId_idx" ON "library_file_tags"("tagId");

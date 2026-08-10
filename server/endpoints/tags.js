const prisma = require("../utils/prisma");
const { reqBody } = require("../utils/http");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { validWorkspaceSlug } = require("../utils/middleware/validWorkspace");
const { getLLMProvider } = require("../utils/helpers");
const fs = require("fs/promises");
const path = require("path");

const routeGuards = [
  validatedRequest,
  flexUserRoleValid([ROLES.all]),
  validWorkspaceSlug,
];

async function getLibrary(workspace) {
  return await prisma.libraries.findUnique({
    where: { workspaceId: workspace.id },
  });
}

function tagsEndpoints(app) {
  if (!app) return;

  // GET /tags/:slug - list all tags for a workspace with file counts
  app.get("/tags/:slug", routeGuards, async (_request, response) => {
    try {
      const workspace = response.locals.workspace;
      const library = await getLibrary(workspace);
      if (!library) {
        return response.status(200).json({ tags: [] });
      }

      const fileIds = (
        await prisma.library_files.findMany({
          where: { libraryId: library.id },
          select: { id: true },
        })
      ).map((f) => f.id);

      if (fileIds.length === 0) {
        return response.status(200).json({ tags: [] });
      }

      const tagRecords = await prisma.tags.findMany({
        where: {
          files: {
            some: { libraryFileId: { in: fileIds } },
          },
        },
        include: {
          _count: {
            select: {
              files: {
                where: { libraryFileId: { in: fileIds } },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      const tags = tagRecords.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        createdAt: t.createdAt,
        fileCount: t._count.files,
      }));

      response.status(200).json({ tags });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: error.message });
    }
  });

  // POST /tags/:slug - create a new tag
  app.post("/tags/:slug", routeGuards, async (request, response) => {
    try {
      const { name, color } = reqBody(request);
      if (!name || typeof name !== "string" || !name.trim()) {
        return response.status(400).json({ error: "Tag name is required." });
      }

      const existing = await prisma.tags.findUnique({
        where: { name: name.trim() },
      });
      if (existing) {
        return response.status(200).json({ tag: existing });
      }

      const tag = await prisma.tags.create({
        data: {
          name: name.trim(),
          color: color || null,
        },
      });

      response.status(201).json({ tag });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: error.message });
    }
  });

  // DELETE /tags/:slug/:id - delete a tag
  app.delete("/tags/:slug/:id", routeGuards, async (request, response) => {
    try {
      const { id } = request.params;
      const tagId = parseInt(id, 10);

      if (isNaN(tagId)) {
        return response.status(400).json({ error: "Invalid tag id." });
      }

      await prisma.tags.delete({
        where: { id: tagId },
      });

      response.status(200).json({ success: true });
    } catch (error) {
      console.error(error);
      if (error.code === "P2025") {
        return response.status(404).json({ error: "Tag not found." });
      }
      response.status(500).json({ error: error.message });
    }
  });

  // POST /tags/:slug/assign - assign tags to a library file
  app.post("/tags/:slug/assign", routeGuards, async (request, response) => {
    try {
      const { fileId, tagIds = [] } = reqBody(request);
      if (!fileId) {
        return response.status(400).json({ error: "fileId is required." });
      }

      const workspace = response.locals.workspace;
      const library = await getLibrary(workspace);

      // Verify the file belongs to this workspace's library
      const file = await prisma.library_files.findFirst({
        where: { id: fileId, libraryId: library?.id },
      });
      if (!file) {
        return response
          .status(404)
          .json({ error: "File not found in this workspace." });
      }

      // Remove existing tag assignments for this file
      await prisma.library_file_tags.deleteMany({
        where: { libraryFileId: fileId },
      });

      // Assign new tags
      if (tagIds.length > 0) {
        await prisma.library_file_tags.createMany({
          data: tagIds.map((tagId) => ({
            libraryFileId: fileId,
            tagId,
          })),
        });
      }

      // Return updated assignments
      const updatedTags = await prisma.library_file_tags.findMany({
        where: { libraryFileId: fileId },
        include: { tag: true },
      });

      response.status(200).json({
        fileId,
        tags: updatedTags.map((ut) => ut.tag),
      });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: error.message });
    }
  });

  // POST /tags/:slug/suggest - AI-suggest tags for a file
  app.post("/tags/:slug/suggest", routeGuards, async (request, response) => {
    try {
      const { fileId, filePath } = reqBody(request);
      if (!fileId || !filePath) {
        return response
          .status(400)
          .json({ error: "fileId and filePath are required." });
      }

      const workspace = response.locals.workspace;
      const library = await getLibrary(workspace);
      if (!library) {
        return response.status(404).json({ error: "Library not found." });
      }

      // Verify file exists in this workspace
      const file = await prisma.library_files.findFirst({
        where: { id: fileId, libraryId: library.id },
      });
      if (!file) {
        return response
          .status(404)
          .json({ error: "File not found in this workspace." });
      }

      // Read file content from disk
      const fullPath = path.resolve(library.rootPath, filePath);
      let content;
      try {
        content = await fs.readFile(fullPath, "utf8");
      } catch {
        return response
          .status(400)
          .json({ error: "Failed to read file content." });
      }

      // Truncate content if too long (max ~8000 chars for prompt)
      const maxContentLength = 8000;
      const truncatedContent =
        content.length > maxContentLength
          ? content.substring(0, maxContentLength) + "\n...(truncated)"
          : content;

      // Get existing tag names for context
      const existingTags = await prisma.tags.findMany({
        where: {
          files: {
            some: {
              file: { libraryId: library.id },
            },
          },
        },
        select: { name: true },
      });
      const existingTagNames = existingTags.map((t) => t.name);

      // Build prompt for LLM
      const systemPrompt = `You are a file classification assistant. Given a file's name and content, suggest relevant tags. ${existingTagNames.length > 0 ? `Choose from these existing tags when possible: ${existingTagNames.join(", ")}. ` : ""}You may also suggest new tags if needed. Return only a JSON array of tag name strings, like: ["tag1", "tag2"]. Do not include any other text.`;

      const userPrompt = `File name: ${file.displayName}\nFile path: ${file.relativePath}\n\nContent:\n${truncatedContent}`;

      // Call LLM
      const llmProvider = getLLMProvider({
        provider: workspace.chatProvider,
        model: workspace.chatModel,
      });

      const result = await llmProvider.getChatCompletion(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { temperature: 0.3 }
      );

      let suggestions = [];
      if (result?.textResponse) {
        try {
          const jsonMatch = result.textResponse.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            suggestions = JSON.parse(jsonMatch[0]);
          }
        } catch {
          // If JSON parsing fails, try splitting by comma
          suggestions = result.textResponse
            .split(",")
            .map((s) => s.replace(/[\[\]"\s]/g, ""))
            .filter(Boolean);
        }
      }

      // Find or create tags for the suggestions
      const suggestedTags = [];
      for (const tagName of suggestions) {
        if (!tagName || typeof tagName !== "string") continue;
        const trimmed = tagName.trim();
        if (!trimmed || trimmed.length > 50) continue;

        let tag = await prisma.tags.findUnique({
          where: { name: trimmed },
        });
        if (!tag) {
          tag = await prisma.tags.create({
            data: { name: trimmed },
          });
        }
        suggestedTags.push(tag);
      }

      response.status(200).json({ fileId, tags: suggestedTags });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: error.message });
    }
  });

  // POST /tags/:slug/batch-classify - AI auto-classify all untagged files
  app.post(
    "/tags/:slug/batch-classify",
    routeGuards,
    async (_request, response) => {
      try {
        const workspace = response.locals.workspace;
        const library = await getLibrary(workspace);
        if (!library) {
          return response.status(404).json({ error: "Library not found." });
        }

        // Find all files without tags
        const allFiles = await prisma.library_files.findMany({
          where: { libraryId: library.id },
          include: { tags: true },
        });
        const untaggedFiles = allFiles.filter((f) => f.tags.length === 0);

        if (untaggedFiles.length === 0) {
          return response
            .status(200)
            .json({ message: "All files already have tags.", results: [] });
        }

        // Get existing tags for context
        const existingTags = await prisma.tags.findMany({
          where: {
            files: {
              some: {
                file: { libraryId: library.id },
              },
            },
          },
          select: { name: true },
        });
        const existingTagNames = existingTags.map((t) => t.name);

        const results = [];

        for (const file of untaggedFiles) {
          const fullPath = path.resolve(library.rootPath, file.relativePath);
          let content;
          try {
            content = await fs.readFile(fullPath, "utf8");
          } catch {
            results.push({
              fileId: file.id,
              displayName: file.displayName,
              error: "Failed to read file content.",
            });
            continue;
          }

          const maxContentLength = 4000;
          const truncatedContent =
            content.length > maxContentLength
              ? content.substring(0, maxContentLength) + "\n...(truncated)"
              : content;

          const systemPrompt = `You are a file classification assistant. Suggest 1-3 relevant tags for a file. ${existingTagNames.length > 0 ? `Prefer these existing tags: ${existingTagNames.join(", ")}. ` : ""}Return only a JSON array of tag name strings, like: ["tag1", "tag2"]. No other text.`;

          const userPrompt = `File name: ${file.displayName}\nPath: ${file.relativePath}\n\nContent:\n${truncatedContent}`;

          let tags = [];
          try {
            const llmProvider = getLLMProvider({
              provider: workspace.chatProvider,
              model: workspace.chatModel,
            });

            const result = await llmProvider.getChatCompletion(
              [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              { temperature: 0.3 }
            );

            if (result?.textResponse) {
              try {
                const jsonMatch = result.textResponse.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  tags = JSON.parse(jsonMatch[0]);
                }
              } catch {
                tags = result.textResponse
                  .split(",")
                  .map((s) => s.replace(/[\[\]"\s]/g, ""))
                  .filter(Boolean);
              }
            }
          } catch (e) {
            results.push({
              fileId: file.id,
              displayName: file.displayName,
              error: `LLM error: ${e.message}`,
            });
            continue;
          }

          // Find or create tags and assign
          const tagIds = [];
          for (const tagName of tags) {
            if (!tagName || typeof tagName !== "string") continue;
            const trimmed = tagName.trim();
            if (!trimmed || trimmed.length > 50) continue;

            let tag = await prisma.tags.findUnique({
              where: { name: trimmed },
            });
            if (!tag) {
              tag = await prisma.tags.create({
                data: { name: trimmed },
              });
            }
            tagIds.push(tag.id);
          }

          if (tagIds.length > 0) {
            await prisma.library_file_tags.createMany({
              data: tagIds.map((tagId) => ({
                libraryFileId: file.id,
                tagId,
              })),
            });
          }

          results.push({
            fileId: file.id,
            displayName: file.displayName,
            tags,
          });
        }

        response.status(200).json({
          message: `Classified ${results.length} files.`,
          results,
        });
      } catch (error) {
        console.error(error);
        response.status(500).json({ error: error.message });
      }
    }
  );
}

module.exports = { tagsEndpoints };

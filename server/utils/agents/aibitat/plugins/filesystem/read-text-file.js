const path = require("path");
const filesystem = require("./lib.js");

module.exports.FilesystemReadTextFile = {
  name: "filesystem-read-text-file",
  plugin: function () {
    return {
      name: "filesystem-read-text-file",
      setup(aibitat) {
        aibitat.function({
          super: aibitat,
          name: this.name,
          description:
            "Read a vault file by exact path (primary tool for full-doc understanding, rewrite, and creation prep). " +
            "Supports text/markdown and many parseable types; images may be attached visually. " +
            "If path is unknown, navigate with list-directory or search-files first. " +
            "Long notes: use head to scan Markdown headings, then read more or tail as needed; call again if more context is required. " +
            "Summarize in your reply after reading — there is no separate summarize tool. " +
            "Only works within the workspace vault sandbox.",
          examples: [
            {
              prompt: "Read the contents of config.json",
              call: JSON.stringify({ path: "config.json" }),
            },
            {
              prompt: "Show me the last 50 lines of the log file",
              call: JSON.stringify({ path: "logs/app.log", tail: 50 }),
            },
            {
              prompt: "Read just the first 10 lines of README.md",
              call: JSON.stringify({ path: "README.md", head: 10 }),
            },
            {
              prompt: "Show me the screenshot.png image",
              call: JSON.stringify({ path: "screenshot.png" }),
            },
          ],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              path: {
                type: "string",
                description:
                  "File path relative to the vault root (e.g. AI/RAG.md). Prefer relative paths over OS absolute paths.",
              },
              head: {
                type: "number",
                description:
                  "If provided, returns only the first N lines of the file.",
              },
              tail: {
                type: "number",
                description:
                  "If provided, returns only the last N lines of the file.",
              },
            },
            required: ["path"],
            additionalProperties: false,
          },
          handler: async function ({ path: filePath = "", head, tail }) {
            try {
              this.super.handlerProps.log(
                `Using the filesystem-read-text-file tool.`
              );

              if (head && tail) {
                return "Error: Cannot specify both head and tail parameters simultaneously.";
              }

              const validPath = await filesystem.validatePath(filePath);

              if (filesystem.isImageFile(validPath)) {
                this.super.introspect(
                  `${this.caller}: Detected image file ${filePath}, attaching for viewing`
                );
                const attachment =
                  await filesystem.readImageAsAttachment(validPath);
                if (attachment) {
                  this.super.addToolAttachment?.(attachment);
                  const filename = path.basename(validPath);
                  return `Image file "${filename}" has been attached and is now visible in the conversation. You can describe what you see in the image.`;
                }
                return `Error: Could not read image file "${path.basename(validPath)}"`;
              }

              this.super.introspect(`${this.caller}: Reading file ${filePath}`);

              let content;
              if (tail) {
                content = await filesystem.tailFile(validPath, tail);
                this.super.introspect(
                  `Retrieved last ${tail} lines of ${filePath}`
                );
              } else if (head) {
                content = await filesystem.headFile(validPath, head);
                this.super.introspect(
                  `Retrieved first ${head} lines of ${filePath}`
                );
              } else {
                content = await filesystem.readFileContent(validPath);
                this.super.introspect(`Successfully read ${filePath}`);
              }

              const { content: finalContent, wasTruncated } =
                filesystem.truncateContentForContext(
                  content,
                  this.super,
                  "[Content truncated - file exceeds context limit. Use head/tail parameters to read specific portions.]"
                );

              if (wasTruncated) {
                this.super.introspect(
                  `${this.caller}: File content was truncated to fit context limit`
                );
              }

              const { buildFsCitation } = require("../../utils/agentCitations");
              this.super.addCitation?.(
                buildFsCitation({
                  absPath: validPath,
                  content: finalContent,
                  allowedDirs: filesystem.getAllowedDirectories(),
                })
              );

              return finalContent;
            } catch (e) {
              this.super.handlerProps.log(
                `filesystem-read-text-file error: ${e.message}`
              );
              this.super.introspect(`Error: ${e.message}`);
              return `Error reading file: ${e.message}`;
            }
          },
        });
      },
    };
  },
};

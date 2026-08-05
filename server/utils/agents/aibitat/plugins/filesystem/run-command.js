const filesystem = require("./lib.js");

/**
 * 助手 bash：在 vault 允许目录内执行 shell 命令（不依赖 Claude Code / 外部 CLI）。
 */
const FilesystemRunCommand = {
  name: "filesystem-run-command",
  plugin: function () {
    return {
      name: "filesystem-run-command",
      setup(aibitat) {
        aibitat.function({
          super: aibitat,
          name: this.name,
          description:
            "Run a shell/bash command inside the workspace knowledge vault (allowed directories only). Use for git status, listing files, running local scripts, etc. Working directory defaults to the vault root.",
          examples: [
            {
              prompt: "List markdown files in the vault",
              call: JSON.stringify({
                command: process.platform === "win32" ? "dir /b *.md" : "ls -la",
                cwd: null,
              }),
            },
            {
              prompt: "Show git status",
              call: JSON.stringify({ command: "git status", cwd: null }),
            },
          ],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              command: {
                type: "string",
                description: "The shell command to execute.",
              },
              cwd: {
                type: "string",
                "x-nullable": true,
                description:
                  "Optional working directory relative to or absolute within the vault. Defaults to vault root.",
              },
            },
            required: ["command"],
            additionalProperties: false,
          },
          handler: async function ({ command, cwd = null }) {
            try {
              this.super.introspect(
                `${this.caller}: Running shell command in vault sandbox.`
              );
              const result = await filesystem.runCommand(command, {
                cwd: cwd || null,
                timeoutMs: 60_000,
              });
              const out = [
                `cwd: ${result.cwd}`,
                `exitCode: ${result.exitCode}`,
                result.stdout ? `stdout:\n${result.stdout}` : "stdout: (empty)",
                result.stderr ? `stderr:\n${result.stderr}` : null,
              ]
                .filter(Boolean)
                .join("\n\n");
              return out;
            } catch (e) {
              this.super.handlerProps.log(
                `filesystem-run-command error: ${e.message}`
              );
              return `Command failed: ${e.message}`;
            }
          },
        });
      },
    };
  },
};

module.exports = {
  FilesystemRunCommand,
};

/**
 * 将 collector 数据连接器产出转为 Markdown，写入 Library vault（GitHub/YouTube/…）。
 * collector 可能暂存 storage/documents，导入后只保留 vault。
 */

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { writeMarkdown } = require("./index");
const { Library } = require("../../models/library");
const { connectorVaultFolder } = require("./connectorFolders");

// collector 暂存（内部）；导入时读取后转写进 Vault
const documentsPath =
  process.env.NODE_ENV === "development"
    ? path.resolve(__dirname, "../../storage/documents")
    : path.resolve(
        process.env.STORAGE_DIR || path.join(__dirname, "../../storage"),
        "documents"
      );

function safeName(name, fallback = "untitled") {
  const base = String(name || fallback)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 80);
  return base || fallback;
}

function ensureMdExtension(name) {
  const n = safeName(name);
  return /\.(md|markdown)$/i.test(n) ? n : `${n}.md`;
}

/**
 * 把一条文档记录格式化为 Markdown
 */
function formatDocumentMarkdown(doc) {
  const title = doc.title || doc.name || "未命名";
  const lines = [`# ${title}`, ""];

  if (doc.docSource || doc.source || doc.url) {
    lines.push(`> **来源：** ${doc.docSource || doc.source || doc.url}`);
  }
  if (doc.docAuthor || doc.author) {
    lines.push(`> **作者：** ${doc.docAuthor || doc.author}`);
  }
  if (doc.description && doc.description !== "No description found.") {
    lines.push(`> **简介：** ${String(doc.description).replace(/\n/g, " ").slice(0, 500)}`);
  }
  if (lines.length > 2) lines.push("");

  const body = doc.pageContent || doc.content || "";
  // 若正文已是以 # 开头的 markdown，避免重复标题
  if (body.trimStart().startsWith("#")) {
    lines.push(body.trim());
  } else {
    lines.push(body.trim());
  }
  return lines.join("\n") + "\n";
}

/**
 * 从 documents 目录下的 destination 子目录读取所有 .json 文档
 */
async function readDocumentsFolder(destination) {
  if (!destination || typeof destination !== "string") return [];
  const folder = path.resolve(documentsPath, destination);
  if (!folder.startsWith(path.resolve(documentsPath))) return [];
  if (!fs.existsSync(folder)) return [];

  const entries = await fsp.readdir(folder);
  const docs = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    try {
      const raw = await fsp.readFile(path.join(folder, entry), "utf8");
      const data = JSON.parse(raw);
      if (data.pageContent || data.content) docs.push(data);
    } catch (e) {
      console.warn(`[library.import] 跳过无法解析的文档 ${entry}: ${e.message}`);
    }
  }
  return docs;
}

/**
 * 从 collector 响应中提取文档列表
 * @param {object} result - collector /ext/* 返回体
 */
async function extractDocumentsFromResult(result) {
  if (!result || result.success === false) return [];

  const data = result.data;

  // website-depth: data 为带 pageContent 的数组
  if (Array.isArray(data) && data.length && (data[0].pageContent || data[0].content)) {
    return data;
  }

  // 多数连接器: data.destination 指向 documents 子目录
  if (data?.destination) {
    return await readDocumentsFolder(data.destination);
  }

  // youtube 等若直接返回 content
  if (data?.content || data?.pageContent) {
    return [
      {
        title: data.title,
        docAuthor: data.author,
        description: data.description,
        pageContent: data.content || data.pageContent,
        docSource: data.url || data.docSource,
      },
    ];
  }

  // documents 字段（若 collector 返回）
  if (Array.isArray(result.documents) && result.documents.length) {
    return result.documents;
  }

  return [];
}

/**
 * 将 collector 结果导入 Library vault
 * @param {object} library - Library model row
 * @param {string} connectorKey - 如 youtube / github / website-depth
 * @param {object} collectorResult - collector 响应
 * @returns {{ count: number, folder: string, files: object[] }}
 */
async function importConnectorResultToLibrary(library, connectorKey, collectorResult) {
  const docs = await extractDocumentsFromResult(collectorResult);
  if (!docs.length) {
    console.warn(
      `[library.import] 连接器 ${connectorKey} 无可用文本内容可写入 vault`
    );
    return { count: 0, folder: null, files: [] };
  }

  // Vault 根下直接用连接器名：GitHub/、YouTube/、FeiShu/ …
  const folder = connectorVaultFolder(connectorKey);
  const usedNames = new Set();
  const files = [];

  for (const doc of docs) {
    let base = ensureMdExtension(
      doc.title || doc.name || doc.docSource || "document"
    );
    // 去重文件名
    let fileName = base;
    let i = 1;
    while (usedNames.has(fileName.toLowerCase())) {
      const stem = base.replace(/\.md$/i, "");
      fileName = `${stem}-${i}.md`;
      i += 1;
    }
    usedNames.add(fileName.toLowerCase());

    const relativePath = `${folder}/${fileName}`;
    const markdown = formatDocumentMarkdown(doc);
    const file = await writeMarkdown(library, relativePath, markdown);
    const record = await Library.recordFile(library, file, {
      sourceType: `connector:${connectorKey}`,
      indexStatus: "pending",
    });
    files.push(record);
  }

  console.log(
    `[library.import] ${connectorKey}: 已写入 ${files.length} 个 Markdown → Vault/${folder}`
  );
  return { count: files.length, folder, files };
}

/**
 * 按 workspaceSlug 解析 library 并导入
 */
async function importConnectorForWorkspace(workspace, connectorKey, collectorResult) {
  if (!workspace) return null;
  const library = await Library.forWorkspace(workspace);
  return importConnectorResultToLibrary(library, connectorKey, collectorResult);
}

module.exports = {
  importConnectorResultToLibrary,
  importConnectorForWorkspace,
  formatDocumentMarkdown,
  extractDocumentsFromResult,
  readDocumentsFolder,
  safeName,
};

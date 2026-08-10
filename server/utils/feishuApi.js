/**
 * 飞书开放平台 API 工具
 *
 * 认证方式: OAuth 2.0 user_access_token（弹窗用户授权）
 *
 * 知识库导入流程:
 *   Step 1: getSpaceInfo → 解析 KB URL，获取 space_id
 *   Step 2: listNodes → 递归遍历所有节点
 *   Step 3: getDocxMarkdown → 直接获取 docx 的 Markdown 内容
 */

const FEISHU_AUTH_BASE = "https://accounts.feishu.cn";
const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";

// 飞书代码块语言 ID → Markdown 语言名映射
// https://open.feishu.cn/document/server-docs/docs/docs/docx-v1/data-structure/code-language
const CODE_LANGUAGE_MAP = {
  1:  "plaintext",  2:  "javascript",  3:  "python",
  4:  "java",       5:  "c",           6:  "cpp",
  7:  "go",         8:  "html",        9:  "css",
  10: "sql",        11: "swift",       12: "typescript",
  13: "bash",       14: "json",        15: "yaml",
  16: "rust",       17: "kotlin",      18: "php",
  19: "ruby",       20: "csharp",      21: "scala",
  22: "dart",       23: "objectivec",  24: "r",
  25: "perl",       26: "lua",         27: "groovy",
  28: "markdown",   29: "xml",         30: "toml",
  31: "dockerfile", 32: "makefile",    33: "graphql",
  40: "powershell", 41: "cmake",
};

let _userAccessToken = null;
let _refreshToken = null;
let _tokenExpiresAt = 0;

// ======================== OAuth 认证 ========================

function getAuthUrl() {
  const appId = process.env.FEISHU_APP_ID;
  if (!appId) throw new Error("未配置 FEISHU_APP_ID。");

  const redirectUri = process.env.FEISHU_REDIRECT_URI ||
    `http://localhost:${process.env.SERVER_PORT || 3001}/api/feishu/oauth/callback`;

  const state = Math.random().toString(36).substring(2, 15);
  const params = new URLSearchParams({
    app_id: appId,
    redirect_uri: redirectUri,
    scope: "wiki:wiki:readonly docx:document:readonly drive:drive:readonly offline_access",
    state,
  });

  return { url: `${FEISHU_AUTH_BASE}/open-apis/authen/v1/authorize?${params.toString()}`, state, redirectUri };
}

async function exchangeCode(code, redirectUri) {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("未配置飞书应用凭证（FEISHU_APP_ID / FEISHU_APP_SECRET）。");
  }

  const resp = await fetch(`${FEISHU_AUTH_BASE}/oauth/v3/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await resp.json();
  if (data.code !== 0) throw new Error(`飞书授权失败: ${data.error_description || data.msg || data.code}`);

  _userAccessToken = data.access_token;
  _refreshToken = data.refresh_token || null;
  _tokenExpiresAt = Date.now() + (data.expires_in || 7200) * 1000;

  return { accessToken: _userAccessToken, expiresIn: data.expires_in, refreshToken: _refreshToken, scope: data.scope };
}

async function refreshAccessToken() {
  if (!_refreshToken) throw new Error("没有可用的 refresh_token，请重新授权。");

  const resp = await fetch(`${FEISHU_AUTH_BASE}/oauth/v3/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: process.env.FEISHU_APP_ID,
      client_secret: process.env.FEISHU_APP_SECRET,
      refresh_token: _refreshToken,
    }),
  });

  const data = await resp.json();
  if (data.code !== 0) {
    _userAccessToken = null; _refreshToken = null; _tokenExpiresAt = 0;
    throw new Error(`飞书 token 刷新失败: ${data.error_description || data.code}`);
  }

  _userAccessToken = data.access_token;
  _refreshToken = data.refresh_token || null;
  _tokenExpiresAt = Date.now() + (data.expires_in || 7200) * 1000;
  return { accessToken: _userAccessToken, expiresIn: data.expires_in };
}

function getAuthStatus() {
  const hasUser = !!_userAccessToken && Date.now() < _tokenExpiresAt;
  return {
    authorized: hasUser,
    hasRefreshToken: !!_refreshToken,
  };
}

async function getUserAccessToken() {
  if (_userAccessToken && Date.now() < _tokenExpiresAt - 60000) {
    return _userAccessToken;
  }
  if (_refreshToken) {
    const result = await refreshAccessToken();
    return result.accessToken;
  }
  throw new Error("未授权飞书账号，请点击「授权飞书账号」完成授权。");
}

// ======================== 知识库 API ========================

function parseKnowledgeBaseUrl(url) {
  let match = url.match(/feishu\.cn\/wiki\/space\/([^/?]+)/);
  if (match) return { isSpace: true, token: match[1] };

  match = url.match(/feishu\.cn\/wiki\/([^/?]+)/);
  if (match) return { isSpace: false, token: match[1] };

  match = url.match(/\/spaces\/([^/?]+)/);
  if (match) return { isSpace: true, token: match[1] };

  throw new Error("无法解析飞书知识库链接。支持格式: /wiki/space/{id} 或 /wiki/{token}");
}

/** 从单文档 URL 中提取 doc_token */
function parseDocUrl(url) {
  // /docx/ABCDEFG 或 /wiki/ABCDEFG（非 space）
  let match = url.match(/feishu\.cn\/docx\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];

  match = url.match(/feishu\.cn\/wiki\/([A-Za-z0-9_-]+)/);
  if (match && !url.includes("/space/")) return match[1];

  // 也支持直接传 token
  if (/^[A-Za-z0-9_-]{15,}$/.test(url.trim())) return url.trim();

  throw new Error("无法解析飞书文档链接。支持格式: /docx/{token} 或 /wiki/{token}");
}

async function getSpaceInfo(wikiToken) {
  const token = await getUserAccessToken();
  const resp = await fetch(
    `${FEISHU_API_BASE}/wiki/v2/spaces/get_node?token=${encodeURIComponent(wikiToken)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`获取知识库信息失败: ${data.msg || data.code}`);
  return data.data?.node;
}

async function getSpaceById(spaceId) {
  const token = await getUserAccessToken();
  const resp = await fetch(
    `${FEISHU_API_BASE}/wiki/v2/spaces/${encodeURIComponent(spaceId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`获取知识空间信息失败: ${data.msg || data.code}`);
  return data.data?.space;
}

async function listNodes(spaceId, parentToken, token) {
  const allNodes = [];
  let pageToken = null;

  do {
    let url = `${FEISHU_API_BASE}/wiki/v2/spaces/${spaceId}/nodes?page_size=50`;
    if (parentToken) url += `&parent_node_token=${encodeURIComponent(parentToken)}`;
    if (pageToken) url += `&page_token=${pageToken}`;

    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await resp.json();
    if (data.code !== 0) {
      console.warn(`获取节点列表失败 (parent=${parentToken || "root"}): ${data.msg}`);
      break;
    }
    allNodes.push(...(data.data?.items || []));
    pageToken = data.data?.page_token;
  } while (pageToken);

  return allNodes;
}

async function getDocxMarkdown(docToken) {
  const token = await getUserAccessToken();

  // 方式1: blocks 转换（优先，格式可控，能正确渲染表格/引用/标题）
  const blocks = await getDocumentBlocks(docToken);
  if (blocks && blocks.length > 0) {
    const md = blocksToMarkdown(blocks);
    if (md) return md;
  }

  // 方式2: docs/v1/content 兜底（API 返回的 markdown 可能有格式问题）
  const url = `${FEISHU_API_BASE}/docs/v1/content?doc_token=${encodeURIComponent(docToken)}&doc_type=docx&content_type=markdown`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await resp.json();
  if (data.code === 0 && data.data?.content) {
    // URL 解码（API 可能返回编码后的链接）
    let content = data.data.content;
    try {
      content = decodeURIComponent(content);
    } catch (e) { /* 解码失败则使用原始内容 */ }
    return content;
  }

  return null;
}

/** 获取 docx 文档的 block 列表 */
async function getDocumentBlocks(documentId) {
  const token = await getUserAccessToken();
  const blocks = [];
  let pageToken = null;

  do {
    let url = `${FEISHU_API_BASE}/docx/v1/documents/${documentId}/blocks?page_size=500`;
    if (pageToken) url += `&page_token=${pageToken}`;

    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await resp.json();
    if (data.code !== 0) return null;

    const items = data.data?.items || [];
    blocks.push(...items);
    pageToken = data.data?.page_token;
  } while (pageToken);

  return blocks;
}

/**
 * blocks 转 markdown
 * Feishu docx blocks API 返回扁平列表，通过 parent_id/children_ids 关联。
 * 需要构建 blockMap 后从根节点递归渲染。
 */
function blocksToMarkdown(blocks) {
  if (!blocks || blocks.length === 0) return "";

  const blockMap = {};
  for (const b of blocks) blockMap[b.block_id] = b;

  // 找到页面根节点 (block_type 1 = 页面)
  const pageBlock = blocks.find(b => b.block_type === 1);
  let results;

  if (pageBlock) {
    // 从页面节点开始渲染（它会把 children_ids 中的子节点递归渲染）
    const pageMd = renderBlock(pageBlock, blockMap);
    // 兜底：如果页面节点没渲染出内容（children_ids 可能为空），
    // 直接把 parent_id === page_block_id 的节点作为根渲染
    if (!pageMd) {
      const directChildren = blocks.filter(b => b.parent_id === pageBlock.block_id);
      results = directChildren.map(b => renderBlock(b, blockMap)).filter(Boolean);
    } else {
      results = [pageMd];
    }
  } else {
    const rootBlocks = blocks.filter(b => !blockMap[b.parent_id]);
    results = rootBlocks.map(b => renderBlock(b, blockMap)).filter(Boolean);
  }

  return results.join("\n\n");
}

/** 递归渲染单个 block 及其子节点 */
function renderBlock(block, blockMap) {
  if (!block) return null;
  const { block_type } = block;
  const text = extractTextFromBlock(block);
  const childMd = renderChildren(block, blockMap);

  switch (block_type) {
    // 页面（文档根节点，渲染标题为 H1，然后递归子节点）
    case 1: {
      const title = extractTextFromBlock(block);
      if (title && childMd) return `# ${title}\n\n${childMd}`;
      if (title) return `# ${title}`;
      return childMd;
    }

    // 标题
    case 3:  return `# ${text || childMd}`;
    case 4:  return `## ${text || childMd}`;
    case 5:  return `### ${text || childMd}`;
    case 6:  return `#### ${text || childMd}`;
    case 7:  return `##### ${text || childMd}`;
    case 8:  return `###### ${text || childMd}`;
    case 9:
    case 10:
    case 11: return text || childMd ? `**${text || childMd}**` : null;

    // 列表 — 同时渲染文本和子节点
    case 12: {
      if (text && childMd) return `- ${text}\n${indentChildMd(childMd, "  ")}`;
      return `- ${text || childMd}`;
    }
    case 13: {
      if (text && childMd) return `1. ${text}\n${indentChildMd(childMd, "   ")}`;
      return `1. ${text || childMd}`;
    }

    // 代码块
    case 14: {
      const langCode = block.code?.style?.language;
      const lang = CODE_LANGUAGE_MAP[langCode] || "";
      return `\`\`\`${lang}\n${text}\n\`\`\``;
    }

    // 引用块 (旧版)
    case 15: {
      const content = text ? text + (childMd ? "\n" + childMd : "") : (childMd || "");
      if (!content) return null;
      return content.split("\n").map(l => l ? `> ${l}` : ">").join("\n");
    }

    // 待办
    case 16: return `- [ ] ${text || childMd}`;

    // 图片 (block_type=27)
    case 27: {
      const imgUrl = block.image?.image_url || block.image?.file_token || "";
      return imgUrl ? `![](${imgUrl})` : null;
    }

    // 分割线 (block_type=30)
    case 30: return "---";

    // 表格 (block_type=31)
    case 31: return convertTable(block, blockMap);

    // 表格单元格 (block_type=32)
    case 32: {
      return childMd || text || "";
    }

    // 引用容器 (block_type=34) — 渲染子节点，包裹为引用格式
    case 34: {
      const body = childMd || text;
      if (!body) return null;
      return body.split("\n").map(l => l ? `> ${l}` : ">").join("\n");
    }

    // 文本
    case 2:
    default: {
      if (text && childMd) return `${text}\n${childMd}`;
      if (text) return text;
      if (childMd) return childMd;
      return null;
    }
  }
}

/**
 * 获取 block 的子节点列表
 * 优先使用 children_ids，为空时通过 parent_id 从 blockMap 中查找
 */
function findChildBlocks(block, blockMap) {
  if (!block || !blockMap) return [];
  // 优先 children_ids
  if (block.children_ids && block.children_ids.length > 0) {
    return block.children_ids.map(id => blockMap[id]).filter(Boolean);
  }
  // 兜底：通过 parent_id 查找
  return Object.values(blockMap).filter(b => b.parent_id === block.block_id);
}

/** 缩进子节点内容，跳过空行 */
function indentChildMd(md, indent) {
  return md.split("\n").map(l => l ? `${indent}${l}` : "").join("\n");
}

/** 渲染子节点列表 */
function renderChildren(block, blockMap) {
  const children = findChildBlocks(block, blockMap);
  if (children.length === 0) return "";
  return children
    .map(b => renderBlock(b, blockMap))
    .filter(Boolean)
    .join("\n\n");
}

/** 表格转 markdown */
function convertTable(tableBlock, blockMap) {
  const cells = findChildBlocks(tableBlock, blockMap);
  if (cells.length === 0) return "";

  // 计算列数
  const colCount = tableBlock.table?.property?.column_size ||
    tableBlock.table?.column_size ||
    (cells.length > 0 ? cells.filter(c => c.block_type === 20).length : 2);

  // 按行分组 (cells 按行顺序排列)
  const cellGroups = [];
  let currentRow = [];
  for (const cell of cells) {
    currentRow.push(cell);
    if (currentRow.length >= colCount) {
      cellGroups.push(currentRow);
      currentRow = [];
    }
  }
  if (currentRow.length > 0) cellGroups.push(currentRow);

  const rows = [];
  for (const row of cellGroups) {
    const rowTexts = row.map((cell) => {
      // 递归渲染单元格内容（可能有嵌套 block）
      return renderBlock(cell, blockMap).replace(/\|/g, "\\|").replace(/\n/g, " ");
    });
    rows.push(`| ${rowTexts.join(" | ")} |`);
  }

  if (rows.length === 0) return "";

  // 表头分隔行
  const headerSep = `| ${Array(colCount).fill("---").join(" | ")} |`;
  rows.splice(1, 0, headerSep);

  return rows.join("\n");
}

function extractTextFromBlock(block) {
  // 不同 block_type 的文本存储在不同属性下
  const textSource = getTextSource(block);
  const textElements = textSource?.elements || [];
  let result = "";

  for (const el of textElements) {
    if (el.text_run) {
      const { content = "" } = el.text_run;
      const style = el.text_run.text_element_style || {};
      let segment = content;

      // 内联代码优先级最高（跳过其他修饰）
      if (style.inline_code) { result += `\`${segment}\``; continue; }
      if (style.bold) segment = `**${segment}**`;
      if (style.italic) segment = `*${segment}*`;
      if (style.strikethrough) segment = `~~${segment}~~`;
      if (style.underline) segment = `<u>${segment}</u>`;

      const linkUrl = style.link?.url;
      if (linkUrl) segment = `[${segment}](${linkUrl})`;

      result += segment;
    } else if (el.mention_user) {
      result += `@${el.mention_user.name || "用户"}`;
    } else if (el.mention_doc) {
      const docTitle = el.mention_doc.title || "文档";
      const docUrl = el.mention_doc.url || "";
      result += docUrl ? `[${docTitle}](${docUrl})` : docTitle;
    } else if (el.mention_date) {
      result += el.mention_date.date || "";
    } else if (el.equation) {
      result += `$${el.equation.content || ""}$`;
    }
  }

  return result.trim();
}

/**
 * 根据 block_type 获取正确的文本源属性
 * Feishu 中不同 block 类型将文本存在不同字段:
 *   heading1~9 / bullet / ordered / text 等
 */
function getTextSource(block) {
  if (!block) return null;

  const typeMap = {
    2: "text",
    3: "heading1", 4: "heading2", 5: "heading3",
    6: "heading4", 7: "heading5", 8: "heading6",
    9: "heading7", 10: "heading8", 11: "heading9",
    12: "bullet",
    13: "ordered",
    14: "code",
    15: "quote",
    16: "todo",
    32: "table_cell",
    34: "quote_container",
  };

  const propName = typeMap[block.block_type];
  if (propName && block[propName]) return block[propName];

  // 兜底: 遍历查找第一个包含 elements 的属性
  for (const key of Object.keys(block)) {
    if (key === "children" || key === "block_id" || key === "block_type" || key === "parent_id") continue;
    if (block[key]?.elements) return block[key];
  }

  // 最后尝试 block.text
  return block.text || null;
}

// ======================== 完整导入流程 ========================

async function fetchAllDocs(spaceId, parentNodeToken, token, parentPath = "", progressCb) {
  const nodes = await listNodes(spaceId, parentNodeToken, token);
  const results = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const title = node.title || "未命名";
    const nodeType = node.node_type;
    const nodeToken = node.node_token;
    const objToken = node.obj_token;
    const objType = node.obj_type;
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, "_");

    if (progressCb) {
      progressCb({ current: i + 1, total: nodes.length, title, type: nodeType });
    }

    if (nodeType === "folder") {
      const childPath = parentPath ? `${parentPath}/${safeTitle}` : safeTitle;
      try {
        const children = await fetchAllDocs(spaceId, nodeToken, token, childPath, progressCb);
        results.push(...children);
      } catch (e) { console.warn(`跳过文件夹 ${safeTitle}: ${e.message}`); }
      continue;
    }

    if (nodeType !== "origin" || !objToken) continue;

    try {
      const fileName = `${safeTitle}.md`;
      const relativePath = parentPath ? `${parentPath}/${fileName}` : fileName;

      let content;
      if (objType === "docx") {
        const markdown = await getDocxMarkdown(objToken);
        content = markdown || `# ${title}\n\n> 无法读取文档内容\n`;
      } else {
        content = `# ${title}\n\n> 文档类型: ${objType || "未知"}，暂不支持导入。\n`;
      }

      results.push({ title, path: relativePath, content });
    } catch (e) { console.warn(`跳过文档 ${title}: ${e.message}`); }
  }

  return results;
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  getUserAccessToken,
  getAuthStatus,
  parseKnowledgeBaseUrl,
  parseDocUrl,
  getSpaceInfo,
  getSpaceById,
  getDocxMarkdown,
  fetchAllDocs,
};

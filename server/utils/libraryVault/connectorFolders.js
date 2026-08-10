/** 连接器 key → Vault 根下文件夹名（GitHub/YouTube/FeiShu/…） */
const CONNECTOR_VAULT_FOLDERS = {
  github: "GitHub",
  gitlab: "GitLab",
  youtube: "YouTube",
  bilibili: "BiliBili",
  video: "Video",
  feishu: "FeiShu",
  "website-depth": "Web",
  website: "Web",
  confluence: "Confluence",
  drupalwiki: "DrupalWiki",
  obsidian: "Obsidian",
  "paperless-ngx": "Paperless",
  paperless: "Paperless",
};

function connectorVaultFolder(connectorKey) {
  const key = String(connectorKey || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-");
  if (CONNECTOR_VAULT_FOLDERS[key]) return CONNECTOR_VAULT_FOLDERS[key];
  // github-repo 等
  for (const [k, folder] of Object.entries(CONNECTOR_VAULT_FOLDERS)) {
    if (key.includes(k)) return folder;
  }
  // 默认：首字母大写的 slug
  if (!key) return "Import";
  return key
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

module.exports = {
  CONNECTOR_VAULT_FOLDERS,
  connectorVaultFolder,
};

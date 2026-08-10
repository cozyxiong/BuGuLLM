/**
 * 视频字幕提取工具
 * 支持 Bilibili、YouTube，输出 Markdown
 *
 * Bilibili: Playwright 持久登录 → 页内 player/wbi/v2 → 下载字幕 JSON
 * YouTube:  与独立连接器相同 — collector + youtube-transcript-plus（parseOnly）
 */

// ======================== URL 解析 ========================

/**
 * 解析视频链接，返回平台类型和视频 ID
 */
function parseVideoUrl(url) {
  const u = url.trim();

  const bvMatch = u.match(/bilibili\.com\/video\/(BV[A-Za-z0-9]+)/i);
  if (bvMatch) return { platform: "bilibili", id: bvMatch[1], raw: u };

  const b23Match = u.match(/b23\.tv\/([A-Za-z0-9]+)/i);
  if (b23Match) return { platform: "bilibili", id: b23Match[1], raw: u, isShort: true };

  const ytMatch = u.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/i
  );
  if (ytMatch) return { platform: "youtube", id: ytMatch[1], raw: u };

  if (/^BV[A-Za-z0-9]{8,}$/i.test(u)) return { platform: "bilibili", id: u, raw: u };

  if (/^[A-Za-z0-9_-]{11}$/.test(u)) return { platform: "youtube", id: u, raw: u };

  throw new Error(
    "无法识别的视频链接。支持：Bilibili (bilibili.com/video/BVxxx)、YouTube (youtube.com/watch?v=xxx / youtu.be/xxx)"
  );
}

// ======================== Bilibili ========================

const BILI_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.bilibili.com/",
};

/**
 * 解析 Bilibili 短链接 (b23.tv)，获取真实 BV 号
 */
async function resolveB23ShortLink(shortId) {
  const resp = await fetch(`https://b23.tv/${shortId}`, {
    headers: BILI_HEADERS,
    redirect: "manual",
  });
  const location = resp.headers.get("location") || "";
  const bvMatch = location.match(/BV[A-Za-z0-9]+/i);
  if (bvMatch) return bvMatch[0];
  throw new Error("无法解析 Bilibili 短链接。");
}

function formatDuration(seconds) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function buildBilibiliMarkdown(bvid, info) {
  const durationStr = formatDuration(info.duration);
  const lines = [
    `# ${info.title}`,
    "",
    `> **来源：** [Bilibili](https://www.bilibili.com/video/${bvid})`,
    `> **作者：** ${info.author}`,
  ];
  if (durationStr) lines.push(`> **时长：** ${durationStr}`);
  lines.push(`> **字幕语言：** ${info.language}`);
  if (info.desc) {
    lines.push("", "## 视频简介", "", info.desc);
  }
  lines.push("", "## 字幕内容", "", info.content);
  return lines.join("\n");
}

// ======================== YouTube ========================

/**
 * 与独立 YouTube 连接器同一路径：collector + youtube-transcript-plus。
 * parseOnly=true 只取字幕，不写入 documents。
 */
async function getYoutubeSubtitles(videoId) {
  const { CollectorApi } = require("./collectorApi");
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  let result;
  try {
    result = await new CollectorApi().forwardExtensionRequest({
      endpoint: "/ext/youtube-transcript",
      method: "POST",
      body: { url, parseOnly: true },
    });
  } catch (e) {
    throw new Error(
      `无法连接字幕服务（collector）：${e.message}。请确认 collector 已启动。`
    );
  }

  if (!result || result.success === false) {
    throw new Error(
      result?.reason ||
        "该视频暂无可用字幕（可能未开启字幕、地区限制或为私有视频）。"
    );
  }

  const data = result.data || {};
  // data.content 为纯字幕；result.content 可能带 <title>…Transcript: 包装
  let pureText = (data.content || data.pageContent || "").trim();
  if (!pureText && typeof result.content === "string") {
    const wrapped = result.content;
    const marker = /Transcript:\n/i;
    pureText = marker.test(wrapped)
      ? wrapped.split(marker).slice(1).join("Transcript:\n").trim()
      : wrapped.trim();
  }

  if (!pureText) {
    throw new Error("字幕内容为空。");
  }

  return {
    title: data.title || videoId,
    author: data.author || "",
    description: data.description || "",
    langLabel: data.language || "自动",
    text: pureText,
  };
}

// ======================== 主入口 ========================

/**
 * 根据视频链接提取字幕，返回 Markdown
 * @param {string} url
 * @returns {{ title: string, markdown: string, platform: string, language: string }}
 */
async function extractVideoSubtitle(url) {
  let parsed = parseVideoUrl(url);

  if (parsed.platform === "bilibili") {
    if (parsed.isShort) {
      parsed.id = await resolveB23ShortLink(parsed.id);
    }

    const { extractBilibiliSubtitle } = require("./videoBrowser");
    const info = await extractBilibiliSubtitle(parsed.id);

    return {
      title: info.title,
      markdown: buildBilibiliMarkdown(parsed.id, info),
      platform: "bilibili",
      language: info.language,
    };
  }

  if (parsed.platform === "youtube") {
    const { title, author, description, langLabel, text } =
      await getYoutubeSubtitles(parsed.id);

    const lines = [
      `# ${title}`,
      "",
      `> **来源：** [YouTube](https://www.youtube.com/watch?v=${parsed.id})`,
    ];
    if (author) lines.push(`> **作者：** ${author}`);
    lines.push(`> **字幕语言：** ${langLabel}`);
    if (description) {
      lines.push("", "## 视频简介", "", description);
    }
    lines.push("", "## 字幕内容", "", text);

    return {
      title,
      markdown: lines.join("\n"),
      platform: "youtube",
      language: langLabel,
    };
  }

  throw new Error("不支持的视频平台。");
}

module.exports = { parseVideoUrl, extractVideoSubtitle };

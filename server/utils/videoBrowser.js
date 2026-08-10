/**
 * Bilibili 字幕提取（Playwright）
 *
 * 唯一路径：持久化 Chromium 登录态 → 页内 player/wbi/v2 → 下载字幕 JSON。
 * Cookie 保存在 storage/bilibili-browser-profile。
 *
 * 登录失效检测（无需用户手删目录）：
 * 1) 本地无 SESSDATA / 按 expires 已过期 → 弹窗登录
 * 2) 本地 Cookie 仍在，但服务端已踢登录 → wbi 字幕轨为空时用 nav 校验；
 *    未登录则自动弹窗重登并重试一次
 */

const path = require("path");
const fs = require("fs/promises");

const STORAGE_ROOT = path.resolve(
  process.env.STORAGE_DIR || path.join(__dirname, "../../storage")
);
const BROWSER_PROFILE_DIR = path.join(STORAGE_ROOT, "bilibili-browser-profile");

const LOGIN_WAIT_MS = 3 * 60 * 1000;
const LOGIN_POLL_MS = 3000;

const BILI_API_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.bilibili.com/",
  Origin: "https://www.bilibili.com",
  "Accept-Language": "zh-CN,zh;q=0.9",
};

let _context = null;
/** @type {boolean|null} */
let _contextHeadless = null;

/**
 * 用浏览器 context 的 request（带 Cookie、无页面 CORS 限制）
 */
async function biliRequestJson(context, url) {
  const resp = await context.request.get(url, {
    headers: BILI_API_HEADERS,
    timeout: 30000,
  });
  const status = resp.status();
  let data;
  try {
    data = await resp.json();
  } catch {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `B 站接口返回非 JSON (HTTP ${status}): ${String(text).slice(0, 120)}`
    );
  }
  if (!resp.ok()) {
    throw new Error(
      `B 站接口 HTTP ${status}: ${data?.message || url}`
    );
  }
  return data;
}

async function ensureProfileDir() {
  await fs.mkdir(BROWSER_PROFILE_DIR, { recursive: true }).catch(() => {});
}

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    throw new Error(
      "未安装 Playwright，无法提取 B 站字幕。\n" +
        "请执行: cd server && npm install playwright && npx playwright install chromium"
    );
  }
}

/**
 * 本地 SESSDATA 是否存在且未到 expires（会话 Cookie expires=-1 视为未过期）
 */
async function getLocalSessdata(context) {
  const cookies = await context.cookies([
    "https://www.bilibili.com",
    "https://bilibili.com",
  ]);
  const sess = cookies.find((c) => c.name === "SESSDATA");
  if (!sess?.value) return null;

  if (typeof sess.expires === "number" && sess.expires > 0) {
    if (sess.expires * 1000 <= Date.now()) {
      console.log("[Bili] 本地 SESSDATA 已过 expires");
      return null;
    }
  }
  return sess;
}

/**
 * 服务端是否仍认登录（Cookie 被踢时本地可能仍有 SESSDATA）
 * 使用 context.request，避免 page.evaluate + fetch 的 CORS/Failed to fetch
 * @returns {Promise<{ isLogin: boolean, mid?: number, uname?: string, code?: number }>}
 */
async function checkServerLogin(context) {
  try {
    const data = await biliRequestJson(
      context,
      "https://api.bilibili.com/x/web-interface/nav"
    );
    const result = {
      code: data.code,
      isLogin: !!(data.data && data.data.isLogin),
      mid: data.data?.mid,
      uname: data.data?.uname,
    };
    console.log(
      `[Bili] nav 登录校验: code=${result.code} isLogin=${result.isLogin}` +
        (result.uname ? ` user=${result.uname}` : "")
    );
    return result;
  } catch (e) {
    console.warn("[Bili] nav 校验失败:", e.message);
    return { code: -1, isLogin: false };
  }
}

async function closeBrowser() {
  if (_context) {
    console.log("[Bili] 关闭 Chromium（Cookie 已写入持久化目录）");
    await _context.close().catch(() => {});
    _context = null;
    _contextHeadless = null;
  }
}

/**
 * @param {boolean} headless
 */
async function launchContext(headless) {
  if (_context) {
    if (_contextHeadless === headless) {
      try {
        _context.pages();
        return _context;
      } catch {
        _context = null;
        _contextHeadless = null;
      }
    }
    await closeBrowser();
  }

  await ensureProfileDir();
  const { chromium } = loadPlaywright();

  _context = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
    headless,
    locale: "zh-CN",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });
  _contextHeadless = headless;
  console.log(`[Bili] Chromium 已启动 (headless=${headless})`);
  return _context;
}

/**
 * 清掉失效的登录相关 Cookie，避免旧态干扰
 */
async function clearLoginCookies(context) {
  try {
    const names = new Set([
      "SESSDATA",
      "DedeUserID",
      "DedeUserID__ckMd5",
      "bili_jct",
      "sid",
    ]);
    const all = await context.cookies();
    const drop = all.filter((c) => names.has(c.name));
    for (const c of drop) {
      await context
        .clearCookies({ name: c.name, domain: c.domain })
        .catch(() => {});
    }
    if (drop.length) {
      console.log(`[Bili] 已清除 ${drop.length} 个登录相关 Cookie`);
    }
  } catch (e) {
    console.warn("[Bili] 清除 Cookie 失败:", e.message);
  }
}

async function waitForLogin(context, page) {
  console.log("[Bili] 请在浏览器窗口中登录 B 站，登录后将自动继续（约 3 分钟超时）...");
  const start = Date.now();
  while (Date.now() - start < LOGIN_WAIT_MS) {
    await new Promise((r) => setTimeout(r, LOGIN_POLL_MS));

    if (!(await getLocalSessdata(context))) continue;

    // 本地有 SESSDATA 后再向服务端确认（用 context.request，不依赖当前页域）
    try {
      const nav = await checkServerLogin(context);
      if (nav.isLogin) {
        console.log("[Bili] 服务端确认已登录，Cookie 将持久保存");
        return;
      }
    } catch {
      // 继续等
    }
  }
  throw new Error("等待 B 站登录超时（3 分钟）。请完成登录后重试。");
}

/**
 * 有头弹窗登录；force=true 时先清登录 Cookie（服务端已踢本地未到期）
 */
async function interactiveLogin({ force = false } = {}) {
  console.log(
    force
      ? "[Bili] 登录态失效（服务端已不认 Cookie），打开浏览器重新登录"
      : "[Bili] 无本地登录态，打开浏览器请登录"
  );

  const context = await launchContext(false);
  if (force) await clearLoginCookies(context);

  const page = await context.newPage();
  try {
    await page.goto("https://passport.bilibili.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await waitForLogin(context, page);
  } finally {
    await page.close().catch(() => {});
  }
  return context;
}

/**
 * 有本地未过期 SESSDATA 则先 headless 复用，否则弹窗登录
 */
async function ensureBrowserContext() {
  let context = await launchContext(true);
  if (await getLocalSessdata(context)) {
    console.log("[Bili] 复用本地 Cookie（随后会用 nav / 字幕接口校验）");
    return context;
  }
  return interactiveLogin({ force: false });
}

function pickSubtitleTrack(tracks) {
  const withUrl = (tracks || []).filter((s) => s.subtitle_url || s.url);
  if (!withUrl.length) return null;

  const isAi = (s) => (s.lan || "").startsWith("ai-");
  const zhOfficial = withUrl.find(
    (s) => s.lan === "zh-CN" || s.lan === "zh-Hans"
  );
  const zhOther = withUrl.find(
    (s) =>
      !isAi(s) &&
      ((s.lan || "").startsWith("zh") || (s.lan_doc || "").includes("中文"))
  );
  const aiZh = withUrl.find(
    (s) => (s.lan || "").startsWith("ai-zh") || s.lan === "ai-zh"
  );
  const en = withUrl.find((s) => (s.lan || "").startsWith("en"));

  return zhOfficial || zhOther || aiZh || en || withUrl[0];
}

function trackLangLabel(track) {
  if (!track) return "未知";
  if ((track.lan || "").startsWith("ai-")) return track.lan_doc || "中文(AI)";
  if ((track.lan || "").startsWith("zh") || (track.lan_doc || "").includes("中文"))
    return "中文";
  if ((track.lan || "").startsWith("en")) return "英文";
  return track.lan_doc || track.lan || "未知";
}

async function openVideoAndReadMeta(page, bvid) {
  console.log(`[Bili] 打开视频 https://www.bilibili.com/video/${bvid}`);
  await page.goto(`https://www.bilibili.com/video/${bvid}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  try {
    await page.waitForFunction(
      () => window.__INITIAL_STATE__?.videoData,
      { timeout: 15000 }
    );
  } catch {
    const title = await page.title();
    if (title.includes("404") || title.includes("不存在")) {
      throw new Error("该视频不存在或已被删除。");
    }
    throw new Error("无法读取视频页面数据，请稍后重试。");
  }

  const meta = await page.evaluate(() => {
    const vd = window.__INITIAL_STATE__?.videoData;
    if (!vd) return null;
    return {
      title: vd.title || "未知标题",
      author: vd.owner?.name || "",
      desc: vd.desc || "",
      duration: vd.duration || 0,
      cid: vd.cid || vd.pages?.[0]?.cid || null,
      bvid: vd.bvid || null,
    };
  });

  if (!meta?.cid) throw new Error("无法获取视频分P信息。");
  return meta;
}

async function fetchWbiTracks(context, bvid, cid) {
  const url = `https://api.bilibili.com/x/player/wbi/v2?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(cid)}`;
  let apiResult;
  try {
    apiResult = await biliRequestJson(context, url);
  } catch (e) {
    console.warn("[Bili] wbi/v2 请求失败:", e.message);
    apiResult = { code: -1, message: e.message };
  }

  const tracks =
    apiResult.data?.subtitle?.subtitles ||
    apiResult.data?.subtitle?.list ||
    [];

  console.log(
    `[Bili] player/wbi/v2 code=${apiResult.code} msg=${apiResult.message || "OK"} 条数=${tracks.length}`
  );
  return { apiResult, tracks };
}

/**
 * 下载字幕 JSON。不用 page.fetch（aisubtitle 等跨域会 Failed to fetch）
 */
async function downloadSubtitleText(context, rawUrl) {
  const url = rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl;
  const resp = await context.request.get(url, {
    headers: {
      ...BILI_API_HEADERS,
      Accept: "application/json,text/plain,*/*",
    },
    timeout: 30000,
  });

  if (!resp.ok()) {
    throw new Error(`字幕下载失败: HTTP ${resp.status()}`);
  }

  let data;
  try {
    data = await resp.json();
  } catch {
    // 少数情况返回纯文本 JSON 但 content-type 异常
    const text = await resp.text();
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("字幕内容解析失败（非 JSON）。");
    }
  }

  if (!data.body || !Array.isArray(data.body)) {
    throw new Error("字幕内容解析失败。");
  }
  return data.body.map((item) => item.content).join("\n");
}

/**
 * 核心提取；allowRelogin=true 时，字幕轨为空且服务端未登录会弹窗重登并递归重试一次
 */
async function extractOnce(bvid, { allowRelogin }) {
  let page = null;
  let context = await ensureBrowserContext();

  try {
    page = await context.newPage();
    await page.setExtraHTTPHeaders({ "Accept-Language": "zh-CN,zh;q=0.9" });

    const meta = await openVideoAndReadMeta(page, bvid);
    const apiBvid = meta.bvid || bvid;

    // 提前用 nav 发现「本地 Cookie 未到期但服务端已踢」
    let nav = await checkServerLogin(context);
    if (!nav.isLogin && allowRelogin) {
      console.log("[Bili] 服务端未登录，触发重新登录");
      await page.close().catch(() => {});
      page = null;
      await interactiveLogin({ force: true });
      return extractOnce(bvid, { allowRelogin: false });
    }

    let { tracks } = await fetchWbiTracks(context, apiBvid, meta.cid);
    let track = pickSubtitleTrack(tracks);

    // 字幕列表拿不到：可能是 Cookie 被踢（与未登录时表现一致）
    if (!track && allowRelogin) {
      nav = await checkServerLogin(context);
      if (!nav.isLogin) {
        console.log("[Bili] 字幕轨为空且服务端未登录 → 弹窗重新登录后重试");
        await page.close().catch(() => {});
        page = null;
        await interactiveLogin({ force: true });
        return extractOnce(bvid, { allowRelogin: false });
      }
      // 已登录仍无轨 → 视频本身没有可用字幕
    }

    if (!track) {
      throw new Error(
        "该视频暂无可用字幕（已确认登录，但没有带下载地址的字幕轨）。"
      );
    }

    const subtitleUrl = track.subtitle_url || track.url;
    const language = trackLangLabel(track);
    console.log(
      `[Bili] 选用字幕: ${language} (${track.lan || ""}) url=${String(subtitleUrl).slice(0, 48)}...`
    );

    const content = await downloadSubtitleText(context, subtitleUrl);
    if (!content?.trim()) throw new Error("字幕内容为空。");

    return {
      title: meta.title,
      author: meta.author,
      desc: meta.desc,
      duration: meta.duration,
      language,
      content,
    };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

/**
 * 在浏览器中提取字幕全文与元数据
 * @returns {{ title, author, desc, duration, language, content }}
 */
async function extractBilibiliSubtitle(bvid) {
  try {
    return await extractOnce(bvid, { allowRelogin: true });
  } catch (e) {
    if (
      e.message?.includes("has been closed") ||
      e.message?.includes("Target closed") ||
      e.message?.includes("browser has been closed")
    ) {
      _context = null;
      _contextHeadless = null;
    }
    if (e.message?.includes("Executable doesn't exist")) {
      throw new Error(
        "Playwright 浏览器未安装。请执行: cd server && npx playwright install chromium"
      );
    }
    throw e;
  } finally {
    await closeBrowser();
  }
}

module.exports = {
  extractBilibiliSubtitle,
  closeBrowser,
};

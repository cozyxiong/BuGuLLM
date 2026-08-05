export const BAGU_LLM_MODE = true;

export const productCopy = {
  knowledgeBase: "\u77e5\u8bc6\u5e93",
  knowledgeBases: "\u77e5\u8bc6\u5e93",
  newKnowledgeBase: "\u65b0\u5efa\u77e5\u8bc6\u5e93",
};

const unavailableRoutePrefixes = [
  "/settings/users",
  "/settings/invites",
  "/settings/community-hub",
  "/settings/beta-features",
  "/settings/mobile-connections",
];

export function isBaGuLLMRoute(pathname) {
  if (!BAGU_LLM_MODE) return true;

  if (unavailableRoutePrefixes.some((prefix) => pathname.startsWith(prefix)))
    return false;

  // 单用户：屏蔽工作区「成员」页
  return !/^\/workspace\/[^/]+\/settings\/members(\/|$)/.test(pathname);
}

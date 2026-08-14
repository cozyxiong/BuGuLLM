const prisma = require("../utils/prisma");
const { SM2 } = require("../utils/sm2");
const {
  normalizeLearningContent,
  hasSourceBinding,
} = require("../utils/learning/contentSchema");

function parseContent(raw) {
  if (raw == null) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function serializeItem(item) {
  if (!item) return item;
  return { ...item, content: parseContent(item.content) };
}

const LearningItem = {
  list: async function (
    workspaceId,
    { itemType, reviewState, limit = 50, offset = 0 } = {}
  ) {
    const where = { workspaceId };
    if (itemType) {
      if (itemType === "quiz") {
        where.itemType = { in: ["quiz_single", "quiz_multi"] };
      } else if (itemType.includes(",")) {
        where.itemType = { in: itemType.split(",").map((s) => s.trim()) };
      } else {
        where.itemType = itemType;
      }
    }
    if (reviewState) where.reviewState = reviewState;
    else where.reviewState = { not: "trash" };

    const [items, total] = await Promise.all([
      prisma.learning_items.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.learning_items.count({ where }),
    ]);
    return { items: items.map(serializeItem), total };
  },

  /** practiceMode=true: 全部非垃圾卡/题；false: SM-2 到期队列 */
  getDueReviews: async function (
    workspaceId,
    { limit = 40, practiceMode = false } = {}
  ) {
    if (practiceMode) {
      const items = await prisma.learning_items.findMany({
        where: {
          workspaceId,
          reviewState: { not: "trash" },
          itemType: { in: ["flashcard", "quiz_single", "quiz_multi"] },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return items.map(serializeItem);
    }

    const items = await prisma.learning_items.findMany({
      where: {
        workspaceId,
        reviewState: { in: ["new", "learning", "review"] },
        itemType: { in: ["flashcard", "quiz_single", "quiz_multi"] },
        OR: [{ nextReviewAt: null }, { nextReviewAt: { lte: new Date() } }],
      },
      orderBy: { nextReviewAt: "asc" },
      take: limit,
    });
    return items.map(serializeItem);
  },

  getTrash: async function (workspaceId, limit = 400) {
    const items = await prisma.learning_items.findMany({
      where: { workspaceId, reviewState: "trash" },
      orderBy: { lastUpdatedAt: "desc" },
      take: limit,
    });
    return items.map(serializeItem);
  },

  getMindmaps: async function (workspaceId, limit = 30) {
    const items = await prisma.learning_items.findMany({
      where: {
        workspaceId,
        itemType: "mindmap",
        reviewState: { not: "trash" },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return items.map(serializeItem);
  },

  create: async function (workspaceId, data) {
    const {
      itemType,
      sourceFileId,
      sourceChunkId,
      title,
      content,
      sourcePaths,
    } = data;

    let finalType = itemType;
    let finalTitle = title || "";
    let finalContent = content;

    if (
      finalType &&
      content &&
      typeof content === "object" &&
      !Array.isArray(content)
    ) {
      const normalized = normalizeLearningContent(finalType, content, {
        sourceFileId,
        sourceChunkId,
        sourcePaths: sourcePaths || content.sourcePaths,
      });
      if (!normalized.ok) {
        throw new Error(normalized.error || "Invalid learning content.");
      }
      finalType = normalized.itemType;
      finalTitle = title || normalized.title || "";
      finalContent = normalized.content;
    } else {
      const c =
        typeof content === "string" ? parseContent(content) : content || {};
      const binding = hasSourceBinding({
        sourceFileId,
        sourceChunkId,
        sourcePaths: sourcePaths || c.sourcePaths,
        content: c,
      });
      if (!binding.ok) throw new Error(binding.error);
      if (sourcePaths?.length && typeof content === "object") {
        finalContent = { ...content, sourcePaths };
      }
    }

    if (sourcePaths?.length && typeof finalContent === "object") {
      finalContent = {
        ...finalContent,
        sourcePaths: finalContent.sourcePaths?.length
          ? finalContent.sourcePaths
          : sourcePaths,
      };
    }

    const payload =
      typeof finalContent === "string"
        ? finalContent
        : JSON.stringify(finalContent);

    return serializeItem(
      await prisma.learning_items.create({
        data: {
          workspaceId,
          itemType: finalType,
          sourceFileId: sourceFileId || null,
          sourceChunkId: sourceChunkId || null,
          title: finalTitle || "",
          content: payload,
          reviewState: "new",
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          nextReviewAt: new Date(),
        },
      })
    );
  },

  getById: async function (id, workspaceId) {
    const item = await prisma.learning_items.findFirst({
      where: { id, workspaceId },
      include: {
        reviewEvents: { orderBy: { reviewedAt: "desc" }, take: 20 },
      },
    });
    return serializeItem(item);
  },

  update: async function (id, workspaceId, data) {
    const patch = { lastUpdatedAt: new Date() };
    if (data.title !== undefined) patch.title = data.title;
    if (data.reviewState !== undefined) patch.reviewState = data.reviewState;
    if (data.content !== undefined) {
      patch.content =
        typeof data.content === "string"
          ? data.content
          : JSON.stringify(data.content);
    }
    await prisma.learning_items.updateMany({
      where: { id, workspaceId },
      data: patch,
    });
    return this.getById(id, workspaceId);
  },

  /**
   * @param {number} quality SM-2 0–5
   * @param {string} [ratingLabel] again|hard|good|easy
   */
  review: async function (id, workspaceId, quality, ratingLabel = null) {
    const item = await prisma.learning_items.findFirst({
      where: { id, workspaceId },
    });
    if (!item) throw new Error("Learning item not found.");

    const sm2 = SM2.calculate({
      quality,
      repetitions: item.repetitions,
      easeFactor: item.easeFactor,
      interval: item.interval,
    });
    const failed = quality < 3;
    const now = new Date();

    const updated = await prisma.learning_items.update({
      where: { id },
      data: {
        reviewState: failed ? "learning" : "review",
        easeFactor: sm2.easeFactor,
        interval: sm2.interval,
        repetitions: failed ? 0 : item.repetitions + 1,
        nextReviewAt: new Date(
          now.getTime() + sm2.interval * 24 * 60 * 60 * 1000
        ),
        lastReviewedAt: now,
      },
    });

    await prisma.review_events.create({
      data: {
        learningItemId: id,
        rating: ratingLabel != null ? String(ratingLabel) : String(quality),
      },
    });

    return serializeItem(updated);
  },

  moveToTrash: async function (id, workspaceId) {
    return prisma.learning_items.updateMany({
      where: { id, workspaceId },
      data: { reviewState: "trash", lastUpdatedAt: new Date() },
    });
  },

  restore: async function (id, workspaceId) {
    return prisma.learning_items.updateMany({
      where: { id, workspaceId, reviewState: "trash" },
      data: {
        reviewState: "new",
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    });
  },

  delete: async function (id, workspaceId) {
    return prisma.learning_items.deleteMany({ where: { id, workspaceId } });
  },

  deleteMany: async function (ids, workspaceId) {
    const list = (Array.isArray(ids) ? ids : [ids])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    if (!list.length) return { count: 0 };
    return prisma.learning_items.deleteMany({
      where: { workspaceId, id: { in: list } },
    });
  },

  emptyTrash: async function (workspaceId) {
    return prisma.learning_items.deleteMany({
      where: { workspaceId, reviewState: "trash" },
    });
  },
};

module.exports = { LearningItem };

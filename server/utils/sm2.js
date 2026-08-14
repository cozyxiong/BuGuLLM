/**
 * SM-2 Spaced Repetition Algorithm
 * Based on SuperMemo SM-2 algorithm
 *
 * @param {Object} params
 * @param {number} params.quality - User rating 0-5 (0=complete blackout, 5=perfect recall)
 * @param {number} params.repetitions - Number of previous repetitions
 * @param {number} params.easeFactor - Current ease factor
 * @param {number} params.interval - Current interval in days
 * @returns {{ easeFactor: number, interval: number }}
 */
function calculate({ quality, repetitions, easeFactor, interval }) {
  quality = Math.max(0, Math.min(5, quality));

  if (quality < 3) {
    // Failed recall: reset
    return {
      easeFactor: Math.max(1.3, easeFactor - 0.2),
      interval: 1,
    };
  }

  // Successful recall
  let newInterval;
  if (repetitions === 0) {
    newInterval = 1;
  } else if (repetitions === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(interval * easeFactor);
  }

  const newEaseFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  return {
    easeFactor: newEaseFactor,
    interval: newInterval,
  };
}

/**
 * Convert user-friendly ratings to SM-2 quality values
 * "again" (forgot) -> 0
 * "hard" (recalled with difficulty) -> 2
 * "good" (recalled with some effort) -> 3
 * "easy" (perfect recall) -> 5
 */
function ratingToQuality(rating) {
  const map = { again: 0, hard: 2, good: 3, easy: 5 };
  return map[rating] ?? 3;
}

module.exports = {
  SM2: { calculate },
  ratingToQuality,
};

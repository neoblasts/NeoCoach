/**
 * LifeOS Mastery & Spaced Repetition Unified Module
 *
 * Bridges the legacy API with the new deterministic Local Mastery Engine
 * and Local Spaced Repetition Engine to guarantee single source of truth.
 */

export * from "./masteryEngine";
export * from "./spacedRepetition";
import { computeTopicMastery } from "./masteryEngine";
import { calculateNextSRSState } from "./spacedRepetition";

/**
 * Backward-compatible wrapper for legacy computeMastery callers
 */
export function computeMastery(events, topicId) {
  return computeTopicMastery(topicId, events);
}

/**
 * Compute review priority for a card — higher = more urgent.
 */
export function getCardReviewPriority(card, events = []) {
  if (!card) return 0;
  if (!card.next_review_date) return 100;

  const now = Date.now();
  const nextDate = new Date(card.next_review_date).getTime();
  const diffDays = Math.floor((now - nextDate) / (1000 * 60 * 60 * 24));

  if (diffDays >= 0) {
    return 100 + diffDays * 10; // Overdue cards get highest priority
  }

  // Not due yet
  return Math.max(0, 50 + diffDays * 5);
}

/**
 * Sort cards by review priority — most urgent first.
 */
export function sortCardsByPriority(cards, events = []) {
  return [...cards].sort(
    (a, b) => getCardReviewPriority(b, events) - getCardReviewPriority(a, events)
  );
}

/**
 * Get mastery text color class based on score.
 */
export function masteryColor(score) {
  if (score >= 70) return "text-emerald-500";
  if (score >= 40) return "text-amber-500";
  return "text-rose-500";
}

/**
 * Get mastery bar color class based on score.
 */
export function masteryBarColor(score) {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

export function difficultyRank(value) {
  const v = String(value || "medium").toLowerCase();
  return v === "easy" ? 0 : v === "hard" ? 2 : 1;
}

export function rankToDifficulty(rank) {
  return rank <= 0 ? "easy" : rank >= 2 ? "hard" : "medium";
}

/** Deterministic pace controller: AI judges the answer, local code controls progression. */
export function nextDifficulty(current, correctness = 0.5, rating = "hard") {
  const rank = difficultyRank(current);
  const score = Number(correctness) || 0;
  if (score >= 0.86 || rating === "easy") return rankToDifficulty(rank + 1);
  if (score >= 0.62 || rating === "good") return rankToDifficulty(rank);
  return rankToDifficulty(rank - 1);
}

export function chooseNextCard(cards, currentId, targetDifficulty) {
  const remaining = cards.filter((card) => card.id !== currentId);
  if (!remaining.length) return null;
  const target = difficultyRank(targetDifficulty);
  return [...remaining].sort((a, b) => {
    const da = Math.abs(difficultyRank(a.difficulty) - target);
    const db = Math.abs(difficultyRank(b.difficulty) - target);
    if (da !== db) return da - db;
    return difficultyRank(a.difficulty) - difficultyRank(b.difficulty);
  })[0];
}

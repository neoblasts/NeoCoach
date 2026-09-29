/**
 * Local Spaced Repetition (SRS) Engine for LifeOS
 *
 * SuperMemo / FSRS-inspired spaced repetition scheduler.
 * Operates 100% locally.
 * AI never calculates review dates or card intervals.
 */

import { localClient } from "@/api/localStorageClient";
import { logLearningEvent, EVENT_TYPES } from "./learningEvents";

export const RATINGS = {
  AGAIN: "again", // Complete failure / lapse (relearn now)
  HARD: "hard",   // Remembered with severe effort
  GOOD: "good",   // Normal successful recall
  EASY: "easy",   // Instantaneous / effortless recall
};

/**
 * Calculates next review date and interval based on card history and rating
 *
 * @param {Object} card - LearningCard entity
 * @param {string} rating - "again" | "hard" | "good" | "easy"
 * @returns {{ intervalDays: number, nextReviewDate: string, easeFactor: number, repetitions: number }}
 */
export function calculateNextSRSState(card, rating) {
  let repetitions = Number(card.repetitions || card.review_count || 0);
  let easeFactor = Number(card.ease_factor || 2.5); // Default SM-2 ease factor
  let intervalDays = 1;

  if (rating === RATINGS.AGAIN) {
    repetitions = 0;
    intervalDays = 1; // Due next day (or same session)
    easeFactor = Math.max(1.3, easeFactor - 0.20);
  } else if (rating === RATINGS.HARD) {
    repetitions += 1;
    intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.round((card.interval_days || 3) * 1.2);
    easeFactor = Math.max(1.3, easeFactor - 0.15);
  } else if (rating === RATINGS.GOOD) {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 4;
    else intervalDays = Math.round((card.interval_days || 4) * easeFactor);
    // Ease factor unchanged
  } else if (rating === RATINGS.EASY) {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 3;
    else if (repetitions === 2) intervalDays = 7;
    else intervalDays = Math.round((card.interval_days || 7) * easeFactor * 1.3);
    easeFactor = Math.min(3.0, easeFactor + 0.15);
  }

  const nextReviewDate = new Date(Date.now() + intervalDays * 86400000).toISOString();

  return {
    intervalDays,
    nextReviewDate,
    easeFactor: Number(easeFactor.toFixed(2)),
    repetitions,
  };
}

/**
 * Updates a card's SRS state in localStorage after a student review
 */
export async function processCardReview(card, rating) {
  const nextState = calculateNextSRSState(card, rating);
  const isMastered = nextState.intervalDays >= 14 && nextState.repetitions >= 4;

  const updated = localClient.entities.LearningCard.update(card.id, {
    interval_days: nextState.intervalDays,
    next_review_date: nextState.nextReviewDate,
    ease_factor: nextState.easeFactor,
    repetitions: nextState.repetitions,
    last_reviewed_at: new Date().toISOString(),
    is_mastered: isMastered,
  });

  // Log to local event bus
  await logLearningEvent({
    event_type: isMastered ? EVENT_TYPES.FLASHCARD_MASTERED : (rating === RATINGS.AGAIN ? EVENT_TYPES.FLASHCARD_FORGOTTEN : EVENT_TYPES.FLASHCARD_REVIEWED),
    card_id: card.id,
    topic_id: card.topic_id || null,
    topic_name: card.title || card.subtopic || card.major_topic,
    subject_id: card.subject_id || null,
    rating,
    is_correct: rating !== RATINGS.AGAIN,
    metadata: {
      intervalDays: nextState.intervalDays,
      repetitions: nextState.repetitions,
    },
  });

  return updated;
}

/**
 * Returns all cards that are due for review right now
 * @returns {Array<Object>}
 */
export function getDueFlashcards() {
  const cards = localClient.entities.LearningCard.list() || [];
  const now = new Date().getTime();

  return cards.filter((card) => {
    if (!card.next_review_date) return true; // Unreviewed card is due
    return new Date(card.next_review_date).getTime() <= now;
  }).sort((a, b) => {
    const aTime = a.next_review_date ? new Date(a.next_review_date).getTime() : 0;
    const bTime = b.next_review_date ? new Date(b.next_review_date).getTime() : 0;
    return aTime - bTime;
  });
}

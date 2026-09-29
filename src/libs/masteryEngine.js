/**
 * Local Mastery Engine for LifeOS
 *
 * Deterministic multi-signal learning mastery calculation.
 * Never calls AI for mathematical or state calculations.
 *
 * Mastery Stages:
 * - NEW: No recorded attempts yet
 * - LEARNING: In initial acquisition phase (1-3 attempts)
 * - WEAK: Low accuracy (< 50%) or recurrent mistakes
 * - STRONG: High accuracy (70-89%) with stable retention
 * - FORGOTTEN: Previously mastered/strong, but decayed due to lack of review
 * - MASTERED: Exceptional accuracy (>= 90%) with 5+ attempts and high retention
 */

/**
 * Calculates topic mastery based on observable learning events and cards.
 *
 * @param {string} topicId
 * @param {Array<Object>} [allEvents]
 * @param {Array<Object>} [allCards]
 * @returns {Object} Deterministic mastery metrics
 */
export function computeTopicMastery(topicId, allEvents = [], allCards = []) {
  const topicEvents = allEvents.filter(
    (e) => e.topic_id === topicId || (e.metadata && e.metadata.topic_id === topicId)
  );

  if (topicEvents.length === 0) {
    return {
      score: 0,
      stage: "NEW",
      confidence: "none",
      accuracy: 0,
      recentAccuracy: 0,
      attempts: 0,
      correctAttempts: 0,
      incorrectAttempts: 0,
      mistakeFrequency: 0,
      retentionScore: 100,
      lastReviewed: null,
      daysSinceReview: 999,
      nextReviewDate: null,
      isDueForReview: false,
      breakdown: {
        accuracyComponent: 0,
        ratingsComponent: 0,
        recencyComponent: 0,
        retentionPenalty: 0,
      },
    };
  }

  // Filter answer evaluation events
  const answerEvents = topicEvents.filter(
    (e) =>
      e.event_type === "card_answered" ||
      e.event_type === "quiz_answered" ||
      e.event_type === "question_answered" ||
      e.event_type === "quick_check" ||
      e.event_type === "flashcard_reviewed"
  );

  const total = answerEvents.length;
  const correct = answerEvents.filter((e) => e.is_correct === true).length;
  const incorrect = total - correct;
  const lifetimeAccuracy = total > 0 ? (correct / total) * 100 : 0;

  // Recent accuracy window (last 10 interactions)
  const recentWindow = answerEvents.slice(-10);
  const recentCorrect = recentWindow.filter((e) => e.is_correct === true).length;
  const recentAccuracy = recentWindow.length > 0 ? (recentCorrect / recentWindow.length) * 100 : 0;

  // Self-assessment ratings ("easy", "good", "hard", "again")
  const ratedEvents = topicEvents.filter((e) => e.rating);
  let ratingPoints = 0;
  ratedEvents.forEach((e) => {
    if (e.rating === "easy") ratingPoints += 100;
    else if (e.rating === "good" || e.rating === "correct") ratingPoints += 80;
    else if (e.rating === "hard") ratingPoints += 45;
    else if (e.rating === "again" || e.rating === "incorrect") ratingPoints += 15;
  });
  const ratingScore = ratedEvents.length > 0 ? ratingPoints / ratedEvents.length : recentAccuracy;

  // Recency and Ebbinghaus-inspired retention decay
  const lastReviewed = topicEvents
    .map((e) => e.created_date || e.created_at)
    .filter(Boolean)
    .sort()
    .pop();

  const daysSinceReview = lastReviewed
    ? Math.max(0, Math.floor((Date.now() - new Date(lastReviewed).getTime()) / (1000 * 60 * 60 * 24)))
    : 999;

  // Half-life decay model: Retention = e^(-t / S) where S is stability (days)
  const stabilityDays = Math.max(3, Math.min(30, total * 3));
  const retentionMultiplier = Math.exp(-daysSinceReview / stabilityDays);
  const retentionScore = Math.round(Math.max(10, Math.min(100, retentionMultiplier * 100)));

  // Mistake frequency penalty
  const mistakeFrequency = total > 0 ? Math.round((incorrect / total) * 100) : 0;
  const mistakePenalty = Math.min(25, (incorrect / Math.max(1, total)) * 30);

  // Composite raw score calculation
  const accuracyWeight = 0.45;
  const ratingWeight = 0.25;
  const retentionWeight = 0.30;

  let rawScore = (recentAccuracy * accuracyWeight) + (ratingScore * ratingWeight) + (retentionScore * retentionWeight);
  rawScore = Math.max(0, Math.min(100, rawScore - mistakePenalty));

  // Determine Mastery Stage deterministically
  let stage = "NEW";
  if (total === 0) {
    stage = "NEW";
  } else if (total < 4 && rawScore < 85) {
    stage = "LEARNING";
  } else if (rawScore >= 90 && total >= 5 && daysSinceReview <= 14) {
    stage = "MASTERED";
  } else if (rawScore >= 70 && daysSinceReview <= 21) {
    stage = "STRONG";
  } else if (daysSinceReview > 14 && rawScore < 65 && total >= 3) {
    stage = "FORGOTTEN";
  } else if (rawScore < 50 || mistakeFrequency > 45) {
    stage = "WEAK";
  } else {
    stage = "LEARNING";
  }

  // Spaced repetition review due date
  const reviewIntervalDays = stage === "MASTERED" ? 14 : stage === "STRONG" ? 7 : stage === "WEAK" ? 1 : 3;
  const isDueForReview = daysSinceReview >= reviewIntervalDays;
  const nextReviewDate = lastReviewed
    ? new Date(new Date(lastReviewed).getTime() + reviewIntervalDays * 86400000).toISOString()
    : new Date().toISOString();

  const confidence = total >= 10 ? "high" : total >= 4 ? "medium" : "low";

  return {
    score: Math.round(rawScore),
    stage,
    confidence,
    accuracy: Math.round(lifetimeAccuracy),
    recentAccuracy: Math.round(recentAccuracy),
    attempts: total,
    correctAttempts: correct,
    incorrectAttempts: incorrect,
    mistakeFrequency,
    retentionScore,
    lastReviewed,
    daysSinceReview,
    nextReviewDate,
    isDueForReview,
    breakdown: {
      accuracyComponent: Math.round(recentAccuracy * accuracyWeight),
      ratingsComponent: Math.round(ratingScore * ratingWeight),
      recencyComponent: Math.round(retentionScore * retentionWeight),
      mistakePenalty: Math.round(mistakePenalty),
    },
  };
}

/**
 * Stage color classes for consistent badge & indicator rendering
 */
export function getStageColor(stage) {
  switch (stage) {
    case "MASTERED":
      return { badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", text: "text-emerald-400", bar: "bg-emerald-500" };
    case "STRONG":
      return { badge: "border-teal-500/30 bg-teal-500/10 text-teal-400", text: "text-teal-400", bar: "bg-teal-500" };
    case "LEARNING":
      return { badge: "border-blue-500/30 bg-blue-500/10 text-blue-400", text: "text-blue-400", bar: "bg-blue-500" };
    case "FORGOTTEN":
      return { badge: "border-orange-500/30 bg-orange-500/10 text-orange-400", text: "text-orange-400", bar: "bg-orange-500" };
    case "WEAK":
      return { badge: "border-rose-500/30 bg-rose-500/10 text-rose-400", text: "text-rose-400", bar: "bg-rose-500" };
    default:
      return { badge: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400", text: "text-zinc-400", bar: "bg-zinc-500" };
  }
}

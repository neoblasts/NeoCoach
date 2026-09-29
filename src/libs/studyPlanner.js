/**
 * Local Daily & Weekly Study Planner for LifeOS
 *
 * Deterministically constructs optimal daily study schedules and time blocks.
 * Operates 100% locally.
 * AI never recalculates basic scheduling blocks.
 */

import { localClient } from "@/api/localStorageClient";
import { buildKnowledgeGraph, getWeakTopics } from "./knowledgeGraph";
import { getDueFlashcards } from "./spacedRepetition";
import { getMistakeAnalysis } from "./mistakeEngine";

/**
 * Generates an adaptive daily study schedule based on available time and learning signals
 *
 * @param {number} [availableMinutes=90]
 * @returns {Object} Daily plan breakdown with ordered blocks
 */
export function generateDailyPlan(availableMinutes = 90) {
  const graph = buildKnowledgeGraph();
  const dueCards = getDueFlashcards();
  const weakTopics = getWeakTopics();
  const mistakeAnalysis = getMistakeAnalysis();
  const allTopics = Object.values(graph.topics);

  const blocks = [];
  let remainingTime = availableMinutes;

  // 1. Weak topic review (if any) — 20-30 min
  if (weakTopics.length > 0 && remainingTime >= 20) {
    const topic = weakTopics[0];
    const duration = Math.min(25, remainingTime);
    blocks.push({
      id: "block_weak_topic",
      type: "weak_topic",
      title: `Review Weak Topic: ${topic.name}`,
      subject: topic.subjectName,
      topicId: topic.id,
      durationMinutes: duration,
      badge: "Weak Topic",
      accent: "rose",
      description: `Target mastery (${topic.mastery}%) and address ${topic.mistakeCount} recorded mistake signals.`,
      actionUrl: `/focus?subjectId=${topic.subjectId}&topic_id=${topic.id}&label=${encodeURIComponent(`${topic.subjectName} — ${topic.name}`)}`,
      completed: false,
    });
    remainingTime -= duration;
  }

  // 2. Spaced Repetition Flashcards — 15 min
  if (dueCards.length > 0 && remainingTime >= 15) {
    const dueCount = dueCards.length;
    const duration = Math.min(15, remainingTime);
    blocks.push({
      id: "block_flashcards",
      type: "flashcards",
      title: `Spaced Recall: ${dueCount} Due Flashcards`,
      subject: "All Subjects",
      durationMinutes: duration,
      badge: "Spaced Repetition",
      accent: "teal",
      description: "Fast active recall cards to preserve long-term retention.",
      actionUrl: "/learn?tab=cards",
      completed: false,
    });
    remainingTime -= duration;
  }

  // 3. Targeted Questions / Practice Quiz — 25 min
  if (remainingTime >= 20) {
    const practiceTopic = weakTopics[1] || weakTopics[0] || allTopics.find((t) => t.stage === "LEARNING") || allTopics[0];
    const duration = Math.min(25, remainingTime);
    blocks.push({
      id: "block_practice_quiz",
      type: "quiz",
      title: practiceTopic ? `Targeted Quiz: ${practiceTopic.name}` : "Concept Practice Quiz",
      subject: practiceTopic?.subjectName || "Practice",
      topicId: practiceTopic?.id,
      durationMinutes: duration,
      badge: "Active Testing",
      accent: "amber",
      description: "Solve multiple-choice and conceptual problems to verify retrieval.",
      actionUrl: "/learn?tab=quiz",
      completed: false,
    });
    remainingTime -= duration;
  }

  // 4. Mistake Review & Root-Cause Check — 10 min
  if (mistakeAnalysis.totalMistakes > 0 && remainingTime >= 10) {
    const duration = Math.min(15, remainingTime);
    blocks.push({
      id: "block_mistakes",
      type: "mistake_review",
      title: "Mistake & Error Pattern Audit",
      subject: "Pattern Diagnosis",
      durationMinutes: duration,
      badge: "Mistake Engine",
      accent: "orange",
      description: `Review recent errors (${mistakeAnalysis.dominantType} patterns detected).`,
      actionUrl: "/study-coach",
      completed: false,
    });
    remainingTime -= duration;
  }

  // 5. New Topic / Forward Progress — remaining time
  if (remainingTime >= 15) {
    const newTopic = allTopics.find((t) => t.stage === "NEW") || allTopics[0];
    const duration = remainingTime;
    blocks.push({
      id: "block_new_topic",
      type: "new_topic",
      title: newTopic ? `Learn New Concept: ${newTopic.name}` : "Syllabus Advancement",
      subject: newTopic?.subjectName || "General",
      topicId: newTopic?.id,
      durationMinutes: duration,
      badge: "New Content",
      accent: "blue",
      description: "Build mental model and create initial summary notes.",
      actionUrl: newTopic ? `/focus?subjectId=${newTopic.subjectId}&topic_id=${newTopic.id}` : "/focus",
      completed: false,
    });
    remainingTime = 0;
  }

  return {
    totalPlannedMinutes: availableMinutes - remainingTime,
    blocks,
    summary: `${blocks.length} structured time blocks covering reinforcement, spaced review, and practice.`,
  };
}

/**
 * Computes weekly learning analytics 100% locally
 * @returns {Object}
 */
export function getWeeklyReviewStats() {
  const events = localClient.entities.LearningEvent.list("-created_date", 1000) || [];
  const focusSessions = localClient.entities.FocusSession.list("-started_at", 500) || [];
  const graph = buildKnowledgeGraph();

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  // Filter 7-day events
  const weekEvents = events.filter((e) => {
    const d = new Date(e.created_date || e.created_at);
    return d >= sevenDaysAgo;
  });

  const weekSessions = focusSessions.filter((s) => {
    const d = new Date(s.started_at || s.created_at);
    return d >= sevenDaysAgo;
  });

  // Calculate focus seconds
  const totalFocusSeconds = weekSessions.reduce((sum, s) => sum + Number(s.duration_seconds || s.duration || 0), 0);
  const totalFocusMinutes = Math.round(totalFocusSeconds / 60);

  // Questions attempted & accuracy
  const questionsAnswered = weekEvents.filter((e) =>
    e.event_type === "card_answered" || e.event_type === "quiz_answered" || e.event_type === "question_answered"
  );
  const correctCount = questionsAnswered.filter((e) => e.is_correct === true).length;
  const accuracy = questionsAnswered.length > 0 ? Math.round((correctCount / questionsAnswered.length) * 100) : 0;

  // Unique topics studied
  const topicsStudiedSet = new Set();
  weekEvents.forEach((e) => {
    if (e.topic_name) topicsStudiedSet.add(e.topic_name);
  });

  // Flashcards reviewed
  const cardsReviewed = weekEvents.filter((e) => e.event_type === "flashcard_reviewed" || e.event_type === "card_answered").length;

  return {
    period: "Past 7 Days",
    focusMinutes: totalFocusMinutes,
    focusHoursFormatted: `${Math.floor(totalFocusMinutes / 60)}h ${totalFocusMinutes % 60}m`,
    questionsSolved: questionsAnswered.length,
    accuracy,
    topicsStudiedCount: topicsStudiedSet.size,
    topicsStudiedList: Array.from(topicsStudiedSet).slice(0, 8),
    flashcardsReviewed: cardsReviewed,
    weakTopicsCount: graph.stats.weakCount,
    masteredCount: graph.stats.masteredCount,
    averageMastery: graph.stats.averageMastery,
  };
}

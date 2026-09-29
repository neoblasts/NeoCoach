/**
 * Dashboard Intelligence Module for LifeOS
 *
 * Implements Phase 17: AI Learning Review & Pattern Detection
 *
 * Rule: AI NEVER receives raw history or complete database.
 * The local system builds a compact summary (< 150 tokens) and queries
 * the centralized AI Gateway asynchronously.
 */

import { localClient } from "@/api/localStorageClient";
import { buildKnowledgeGraph, getWeakTopics } from "./knowledgeGraph";
import { getDueFlashcards } from "./spacedRepetition";
import { getMistakeAnalysis } from "./mistakeEngine";
import { aiGateway } from "./aiGatewayClient";

/**
 * Builds the compact, token-efficient local study summary
 * @returns {Object} Tiny JSON summary
 */
export function buildLocalStudySummary() {
  const events = localClient.entities.LearningEvent.list("-created_date", 200) || [];
  const focusSessions = localClient.entities.FocusSession.list("-started_at", 100) || [];
  const weakTopics = getWeakTopics();
  const dueCards = getDueFlashcards();
  const mistakeAnalysis = getMistakeAnalysis();

  const todayStr = new Date().toDateString();

  // Today's events
  const todayEvents = events.filter((e) => {
    const d = new Date(e.created_date || e.created_at);
    return d.toDateString() === todayStr;
  });

  const todaySessions = focusSessions.filter((s) => {
    const d = new Date(s.started_at || s.created_at);
    return d.toDateString() === todayStr;
  });

  const todayFocusSecs = todaySessions.reduce((sum, s) => sum + Number(s.duration_seconds || s.duration || 0), 0);
  const studyMinutes = Math.round(todayFocusSecs / 60);

  const answeredEvents = todayEvents.filter((e) =>
    e.event_type === "card_answered" || e.event_type === "quiz_answered" || e.event_type === "question_answered"
  );
  const correct = answeredEvents.filter((e) => e.is_correct === true).length;
  const accuracy = answeredEvents.length > 0 ? Math.round((correct / answeredEvents.length) * 100) : null;

  const topicsStudied = Array.from(new Set(todayEvents.map((e) => e.topic_name).filter(Boolean))).slice(0, 4);

  return {
    period: "today",
    studyMinutes,
    topicsStudied,
    questionsAttempted: answeredEvents.length,
    accuracy: accuracy !== null ? `${accuracy}%` : "No questions today",
    accuracyNumber: accuracy,
    weakTopics: weakTopics.slice(0, 2).map((t) => t.name),
    repeatedMistake: mistakeAnalysis.patterns[0] || (mistakeAnalysis.dominantType !== "UNKNOWN" ? `${mistakeAnalysis.dominantType} errors` : null),
    flashcardsDue: dueCards.length,
  };
}

/**
 * Generates local deterministic fallback review when offline or without AI
 */
export function getLocalDeterministicReview(summary) {
  const weak = summary.weakTopics?.[0] || (summary.topicsStudied?.[0] || "Core Theory");
  const mistake = summary.repeatedMistake || "unsteady recall under timed conditions";

  return {
    whatChanged: summary.questionsAttempted > 0
      ? `Completed ${summary.questionsAttempted} active recall questions with ${summary.accuracy} accuracy.`
      : (summary.studyMinutes > 0 ? `Logged ${summary.studyMinutes} minutes of focused study.` : "Ready for today's study cycle."),
    needsAttention: weak,
    patternDetected: summary.repeatedMistake
      ? `Detected ${summary.repeatedMistake}.`
      : (summary.flashcardsDue > 0 ? `${summary.flashcardsDue} flashcards due for spaced repetition.` : "Foundational concepts require periodic recall."),
    recommendedAction: `15 min focused review on ${weak} + active recall practice.`,
    recommendedTopic: weak,
    source: "local-engine",
  };
}

/**
 * Fetches the AI Learning Review asynchronously using the centralized AI Gateway.
 * Uses a minimal prompt (< 250 tokens) and falls back to local deterministic review.
 *
 * @returns {Promise<Object>} Structured review
 */
export async function fetchAILearningReview() {
  const summary = buildLocalStudySummary();
  const localFallback = getLocalDeterministicReview(summary);

  try {
    const response = await aiGateway.invoke(
      "AI_LEARNING_REVIEW",
      "chat",
      {
        message: `You are LifeOS AI Learning Reviewer.
Analyze this compact student study summary:
${JSON.stringify(summary, null, 2)}

Produce a STRICT JSON object in this exact shape:
{
  "whatChanged": "1-2 sentence assessment of progress or recent accuracy shifts",
  "needsAttention": "Most critical concept/topic needing reinforcement",
  "patternDetected": "Specific cognitive, conceptual or calculation pattern detected",
  "recommendedAction": "Concrete action: e.g. 10 min concept review + 5 targeted questions"
}
Output ONLY valid JSON.`,
        context: summary,
      },
      { bypassCache: false }
    );

    if (response?.result?.reply) {
      let candidate = response.result.reply.trim();
      candidate = candidate.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const match = candidate.match(/\{[\s\S]*\}/);
      if (match) candidate = match[0];
      const parsed = JSON.parse(candidate);

      if (parsed.whatChanged && parsed.needsAttention) {
        return {
          whatChanged: parsed.whatChanged,
          needsAttention: parsed.needsAttention,
          patternDetected: parsed.patternDetected || localFallback.patternDetected,
          recommendedAction: parsed.recommendedAction || localFallback.recommendedAction,
          recommendedTopic: summary.weakTopics?.[0] || summary.topicsStudied?.[0] || "Core Theory",
          source: "ai-gateway",
          fromCache: response.fromCache,
        };
      }
    }
  } catch (err) {
    console.log("[LifeOS] Asynchronous AI Review used local fallback:", err.message);
  }

  return localFallback;
}

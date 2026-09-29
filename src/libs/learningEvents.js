/**
 * Local Event System for LifeOS
 *
 * Records all meaningful student interactions locally.
 * Events are stored in the local database and broadcast to in-memory subscribers.
 * Critical Architecture Rule: Local events do NOT automatically trigger AI calls.
 */

import { localClient } from "@/api/localStorageClient";

// Event types supported by the system
export const EVENT_TYPES = {
  TOPIC_STARTED: "topic_started",
  TOPIC_COMPLETED: "topic_completed",
  FLASHCARD_REVIEWED: "flashcard_reviewed",
  FLASHCARD_FORGOTTEN: "flashcard_forgotten",
  FLASHCARD_MASTERED: "flashcard_mastered",
  QUIZ_STARTED: "quiz_started",
  QUIZ_COMPLETED: "quiz_completed",
  QUESTION_ANSWERED: "question_answered",
  QUESTION_SKIPPED: "question_skipped",
  MISTAKE_DETECTED: "mistake_detected",
  STUDY_SESSION_STARTED: "study_session_started",
  STUDY_SESSION_COMPLETED: "study_session_completed",
  MOCK_EXAM_COMPLETED: "mock_exam_completed",
  DOCUMENT_STUDIED: "document_studied",
  COACH_SESSION_COMPLETED: "coach_session_completed",
};

// In-memory pub/sub listener set
const subscribers = new Set();

/**
 * Subscribe to local learning events
 * @param {Function} callback - (event) => void
 * @returns {Function} unsubscribe function
 */
export function subscribeToLearningEvents(callback) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Log a learning event locally.
 * Does NOT call AI.
 *
 * @param {Object} eventData
 * @param {string} eventData.event_type - one of EVENT_TYPES
 * @param {string} [eventData.topic_id]
 * @param {string} [eventData.topic_name]
 * @param {string} [eventData.subject_id]
 * @param {string} [eventData.subject_name]
 * @param {boolean} [eventData.is_correct]
 * @param {string} [eventData.mistake_type] - e.g. "concept", "formula", "calculation"
 * @param {string} [eventData.rating] - "easy" | "good" | "hard" | "again"
 * @param {number} [eventData.duration_seconds]
 * @param {number} [eventData.score]
 * @param {number} [eventData.total]
 * @param {Object} [eventData.metadata]
 * @returns {Promise<Object>} The persisted event record
 */
export async function logLearningEvent(eventData) {
  try {
    const payload = {
      event_type: eventData.event_type || eventData.type || "generic_activity",
      topic_id: eventData.topic_id || null,
      topic_name: eventData.topic_name || eventData.topic || null,
      subject_id: eventData.subject_id || null,
      subject_name: eventData.subject_name || eventData.subject || null,
      card_id: eventData.card_id || null,
      is_correct: eventData.is_correct !== undefined ? eventData.is_correct : (eventData.correct ?? null),
      rating: eventData.rating || null,
      mistake_type: eventData.mistake_type || eventData.mistakeType || null,
      score: eventData.score !== undefined ? eventData.score : null,
      total: eventData.total !== undefined ? eventData.total : null,
      duration_seconds: eventData.duration_seconds || eventData.duration || 0,
      difficulty: eventData.difficulty || "medium",
      session_id: eventData.session_id || eventData.sessionId || null,
      created_date: new Date().toISOString(),
      metadata: eventData.metadata || {},
    };

    const saved = localClient.entities.LearningEvent.create(payload);

    // Broadcast to memory subscribers
    subscribers.forEach((fn) => {
      try {
        fn(saved);
      } catch (err) {
        console.warn("[LifeOS Event Bus] Subscriber error:", err);
      }
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("lifeos:learning-event", { detail: saved }));
    }

    return saved;
  } catch (err) {
    console.error("[LifeOS Event Bus] Failed to log learning event:", err);
    return null;
  }
}

/**
 * Get recent activity feed formatted for display
 * @param {number} [limit=20]
 * @returns {Array<Object>}
 */
export function getRecentActivity(limit = 20) {
  try {
    const events = localClient.entities.LearningEvent.list("-created_date", limit);
    return events.map(formatEventForDisplay);
  } catch {
    return [];
  }
}

/**
 * Format a raw event object into a human-friendly activity item
 */
export function formatEventForDisplay(event) {
  const type = event.event_type || event.type;
  const time = event.created_date || event.created_at;
  const topic = event.topic_name || "Study material";
  const subject = event.subject_name || "";

  switch (type) {
    case EVENT_TYPES.FLASHCARD_REVIEWED:
    case "card_answered":
      return {
        id: event.id,
        icon: event.is_correct ? "check" : "alert",
        tone: event.is_correct ? "success" : "warning",
        title: event.is_correct ? `Reviewed ${topic}` : `Struggled with ${topic}`,
        subtitle: event.rating ? `Self-rating: ${event.rating}` : "Flashcard review",
        time,
        topic,
        subject,
      };

    case EVENT_TYPES.FLASHCARD_MASTERED:
      return {
        id: event.id,
        icon: "award",
        tone: "success",
        title: `Mastered ${topic}`,
        subtitle: "Spaced repetition milestone reached",
        time,
        topic,
        subject,
      };

    case EVENT_TYPES.QUIZ_COMPLETED:
    case "quiz_completed":
      return {
        id: event.id,
        icon: "quiz",
        tone: "primary",
        title: `Completed ${topic} quiz`,
        subtitle: `Scored ${event.score ?? 0}/${event.total ?? 0}`,
        time,
        topic,
        subject,
      };

    case EVENT_TYPES.STUDY_SESSION_COMPLETED:
    case "focus_session_completed":
      const mins = Math.round((event.duration_seconds || 0) / 60);
      return {
        id: event.id,
        icon: "timer",
        tone: "primary",
        title: `Completed ${mins}m Focus Session`,
        subtitle: topic ? `Topic: ${topic}` : (subject ? `Subject: ${subject}` : "Deep study"),
        time,
        topic,
        subject,
      };

    case EVENT_TYPES.DOCUMENT_STUDIED:
      return {
        id: event.id,
        icon: "document",
        tone: "neutral",
        title: `Studied notes: ${topic}`,
        subtitle: "Theory & document revision",
        time,
        topic,
        subject,
      };

    case EVENT_TYPES.COACH_SESSION_COMPLETED:
      return {
        id: event.id,
        icon: "coach",
        tone: "accent",
        title: `Tutor session on ${topic}`,
        subtitle: "Socratic learning & active recall",
        time,
        topic,
        subject,
      };

    case EVENT_TYPES.MISTAKE_DETECTED:
      return {
        id: event.id,
        icon: "alert",
        tone: "danger",
        title: `Mistake in ${topic}`,
        subtitle: `Classified as ${event.mistake_type || "conceptual"} error`,
        time,
        topic,
        subject,
      };

    default:
      return {
        id: event.id,
        icon: "dot",
        tone: "neutral",
        title: event.topic_name ? `Studied ${event.topic_name}` : "Learning activity logged",
        subtitle: type.replace(/_/g, " "),
        time,
        topic,
        subject,
      };
  }
}
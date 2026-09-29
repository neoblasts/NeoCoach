/**
 * Background Generation Manager for NeoCoach
 * Manages async background AI generations (Quizzes, Flashcards, Study Coach)
 * so that tasks continue running seamlessly even when users navigate between pages.
 */

import { localClient } from "@/api/localStorageClient";

const jobs = {
  quiz: { status: "idle", topic: "", result: null, error: null, promise: null },
  cards: { status: "idle", topic: "", result: null, error: null, promise: null },
  coach: { status: "idle", topic: "", result: null, error: null, promise: null },
};

const listeners = new Set();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener({ ...jobs });
    } catch (e) {
      console.error("[BackgroundGen] Listener error:", e);
    }
  });
}

export function subscribeGeneration(listener) {
  listeners.add(listener);
  listener({ ...jobs });
  return () => {
    listeners.delete(listener);
  };
}

export function getGenerationState(jobType) {
  return jobs[jobType] || { status: "idle", topic: "", result: null, error: null };
}

export async function startBackgroundQuizGen({ topic, promptText, explicitCount, sourceContent }) {
  if (jobs.quiz.status === "generating") return jobs.quiz.promise;

  jobs.quiz = {
    status: "generating",
    topic,
    result: null,
    error: null,
  };
  notifyListeners();

  const promise = (async () => {
    try {
      const res = await localClient.functions.invoke("learningCoach", {
        operation: "generateQuiz",
        count: explicitCount || 5,
        topic,
        majorTopic: topic,
        customInstructions: promptText,
        sourceText: sourceContent,
      });

      if (res.data?.error) throw new Error(res.data.error);
      const generated = res.data?.result?.questions || [];
      if (!generated.length) throw new Error("No quiz questions returned by AI.");

      const cacheObj = {
        topic,
        questions: generated,
        currentIndex: 0,
        answersMap: {},
        updatedAt: Date.now(),
      };
      try {
        localStorage.setItem("lifeos_active_quiz_cache", JSON.stringify(cacheObj));
      } catch (e) {}

      jobs.quiz = {
        status: "completed",
        topic,
        result: generated,
        error: null,
      };
      notifyListeners();
      return generated;
    } catch (err) {
      jobs.quiz = {
        status: "error",
        topic,
        result: null,
        error: err.message || "Quiz generation failed",
      };
      notifyListeners();
      throw err;
    }
  })();

  jobs.quiz.promise = promise;
  return promise;
}

export async function startBackgroundCardGen({ 
  topic, 
  promptText, 
  explicitCount, 
  sourceContent,
  subjectId,
  topicId,
  assignmentId,
  noteId,
  estimatedLevel,
  masteryScore,
  variationSeed,
  sessionData
}) {
  if (jobs.cards.status === "generating") return jobs.cards.promise;

  jobs.cards = {
    status: "generating",
    topic,
    result: null,
    error: null,
  };
  notifyListeners();

  const promise = (async () => {
    try {
      const res = await localClient.functions.invoke("learningCoach", {
        operation: "generateCards",
        count: explicitCount || 5,
        topic,
        majorTopic: topic,
        customInstructions: promptText,
        sourceText: sourceContent,
        subject_id: subjectId,
        topic_id: topicId,
        assignment_id: assignmentId,
        note_id: noteId,
        studentLevel: estimatedLevel,
        masteryScore: masteryScore || 0,
        variationSeed: variationSeed,
      });

      if (res.data?.error) throw new Error(res.data.error);
      const generated = res.data?.result?.cards || [];
      if (!generated.length) throw new Error("No flashcards returned by AI.");

      const session = sessionData || {
        id: `als_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        majorTopic: topic,
        sourceText: sourceContent ? sourceContent.slice(0, 6000) : "",
        mode: "learning",
        cardNumber: 1,
      };

      // Save to localStorage/database
      const savedCards = generated.map((card, idx) =>
        localClient.entities.LearningCard.create({
          ...card,
          card_type: "learning",
          learning_session_id: session.id,
          card_number: idx + 1,
          created_date: new Date(Date.now() + idx * 10).toISOString(),
        })
      );
      
      session.coveredSubtopics = savedCards.map((c) => c.subtopic).filter(Boolean);
      try {
        localStorage.setItem("lifeos_adaptive_learning_session", JSON.stringify(session));
      } catch (e) {}

      jobs.cards = {
        status: "completed",
        topic,
        result: savedCards,
        error: null,
      };
      notifyListeners();
      return savedCards;
    } catch (err) {
      jobs.cards = {
        status: "error",
        topic,
        result: null,
        error: err.message || "Flashcard generation failed",
      };
      notifyListeners();
      throw err;
    }
  })();

  jobs.cards.promise = promise;
  return promise;
}

export function clearJobState(jobType) {
  if (jobs[jobType]) {
    jobs[jobType] = { status: "idle", topic: "", result: null, error: null, promise: null };
    notifyListeners();
  }
}

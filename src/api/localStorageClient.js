/**
 * LocalStorage-based data manager for LifeOS Desktop
 * Integrates real AI providers (Gemini, Groq) with offline fallback.
 */

import {
  aiGenerateCards,
  aiGenerateQuiz,
  aiEvaluateCardAnswer,
  aiGenerateQuickCheck,
  aiExplainConcept,
  aiTeachStep,
  aiExploreTopic,
  aiRecommend,
  aiChat,
  isAIConfigured
} from "@/libs/aiProviders";

const STORAGE_PREFIX = "lifeos_";

// ─── Storage Initialization ────────────────────────────────────────────────

const ENTITY_NAMES = [
  "Task",
  "Subject",
  "Assignment",
  "CalendarEvent",
  "FocusSession",
  "LearningCard",
  "LearningEvent",
  "Note",
  "Topic",
  "TopicMastery",
  "Reminder",
  "AIInteraction",
  "User",
];

let isDiskSynced = false;

const syncFromDisk = async () => {
  if (!window?.electronAPI?.storage?.getData) {
    isDiskSynced = true;
    return;
  }
  try {
    const diskData = await window.electronAPI.storage.getData();
    if (diskData && typeof diskData === "object") {
      ENTITY_NAMES.forEach((entity) => {
        const key = `${STORAGE_PREFIX}${entity}`;
        const diskItems = diskData[entity];
        if (Array.isArray(diskItems) && diskItems.length > 0) {
          const rawLocal = localStorage.getItem(key);
          let localItems = [];
          try { localItems = rawLocal ? JSON.parse(rawLocal) : []; } catch {}
          if (!localItems.length) {
            localStorage.setItem(key, JSON.stringify(diskItems));
          } else {
            const map = new Map();
            localItems.forEach((item) => { if (item?.id) map.set(item.id, item); });
            diskItems.forEach((item) => {
              if (item?.id) {
                const existing = map.get(item.id);
                if (!existing || (item.updated_at && new Date(item.updated_at) > new Date(existing.updated_at || 0))) {
                  map.set(item.id, item);
                }
              }
            });
            localStorage.setItem(key, JSON.stringify(Array.from(map.values())));
          }
        }
      });
    }
  } catch (e) {
    console.warn("[LifeOS Storage] Disk sync failed:", e);
  } finally {
    isDiskSynced = true;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("lifeos:storage-synced"));
    }
  }
};

const initializeStorage = () => {
  ENTITY_NAMES.forEach((entity) => {
    const key = `${STORAGE_PREFIX}${entity}`;

    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify([]));
    }
  });

  localStorage.setItem(`${STORAGE_PREFIX}initialized`, "true");
  syncFromDisk();
};

const generateId = () =>
  `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ─── Generic Entity Operations ─────────────────────────────────────────────

class LocalStorageClient {
  constructor() {
    initializeStorage();
  }

  persistToDisk() {
    if (!isDiskSynced) {
      console.warn("[LifeOS Storage] Skipping persistToDisk before initial disk sync completion.");
      return;
    }
    if (window?.electronAPI?.storage?.saveData) {
      try {
        const store = {};
        ENTITY_NAMES.forEach((entity) => {
          const raw = localStorage.getItem(`${STORAGE_PREFIX}${entity}`);
          store[entity] = raw ? JSON.parse(raw) : [];
        });
        window.electronAPI.storage.saveData(store);
      } catch (e) {
        console.warn("[LifeOS Storage] Disk persist failed:", e);
      }
    }
  }

  list(entityName, sortField = null, limit = null) {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${entityName}`);

    let data = [];

    try {
      data = raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error(`Failed to parse ${entityName} from localStorage:`, error);
      data = [];
    }

    if (!Array.isArray(data)) {
      data = [];
    }

    let result = [...data];

    if (sortField) {
      const reverse = sortField.startsWith("-");
      const field = reverse ? sortField.substring(1) : sortField;

      result.sort((a, b) => {
        const aVal = a?.[field] ?? "";
        const bVal = b?.[field] ?? "";

        /*
         * Date fields should be compared as dates.
         *
         * This also handles fields such as:
         * - due_date
         * - created_at
         * - updated_at
         * - created_date
         */
        if (
          field.includes("date") ||
          field.includes("at") ||
          field.endsWith("_time")
        ) {
          const aStr = String(aVal || "");
          const bStr = String(bVal || "");
          return reverse ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr);
        }

        if (typeof aVal === "number" && typeof bVal === "number") {
          return reverse ? bVal - aVal : aVal - bVal;
        }

        const aString = String(aVal);
        const bString = String(bVal);

        return reverse
          ? bString.localeCompare(aString)
          : aString.localeCompare(bString);
      });
    }

    if (limit !== null && limit !== undefined) {
      result = result.slice(0, limit);
    }

    return result;
  }

  get(entityName, id) {
    return this.list(entityName).find((item) => item.id === id) || null;
  }

  create(entityName, data = {}) {
    const currentData = this.list(entityName);

    const now = new Date().toISOString();

    const newEntity = {
      id: generateId(),
      created_at: now,
      updated_at: now,
      ...data,
    };

    currentData.push(newEntity);

    localStorage.setItem(
      `${STORAGE_PREFIX}${entityName}`,
      JSON.stringify(currentData)
    );
    this.persistToDisk();

    return newEntity;
  }

  update(entityName, id, data = {}) {
    const currentData = this.list(entityName);

    const index = currentData.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error(`Entity ${id} not found in ${entityName}`);
    }

    const updatedEntity = {
      ...currentData[index],
      ...data,
      updated_at: new Date().toISOString(),
    };

    currentData[index] = updatedEntity;

    localStorage.setItem(
      `${STORAGE_PREFIX}${entityName}`,
      JSON.stringify(currentData)
    );
    this.persistToDisk();

    return updatedEntity;
  }

  delete(entityName, id) {
    const currentData = this.list(entityName);

    const filteredData = currentData.filter((item) => item.id !== id);

    if (currentData.length === filteredData.length) {
      throw new Error(`Entity ${id} not found in ${entityName}`);
    }

    localStorage.setItem(
      `${STORAGE_PREFIX}${entityName}`,
      JSON.stringify(filteredData)
    );
    this.persistToDisk();

    return true;
  }

  query(entityName, filters = {}) {
    let data = this.list(entityName);

    Object.entries(filters).forEach(([key, value]) => {
      data = data.filter((item) => item?.[key] === value);
    });

    return data;
  }

  clearAll() {
    ENTITY_NAMES.forEach((entity) => {
      localStorage.setItem(
        `${STORAGE_PREFIX}${entity}`,
        JSON.stringify([])
      );
    });
    this.persistToDisk();
  }
}

const localStorageClient = new LocalStorageClient();

// ─── Entity Factories ──────────────────────────────────────────────────────

function makeEntity(name) {
  return {
    list: (sort, limit) =>
      localStorageClient.list(name, sort, limit),

    get: (id) =>
      localStorageClient.get(name, id),

    create: (data) =>
      localStorageClient.create(name, data),

    update: (id, data) =>
      localStorageClient.update(name, id, data),

    delete: (id) =>
      localStorageClient.delete(name, id),

    query: (filters) =>
      localStorageClient.query(name, filters),
  };
}

const entities = {};

ENTITY_NAMES.forEach((name) => {
  entities[name] = makeEntity(name);
});

// ─── Local Profile ─────────────────────────────────────────────────────────
//
// No login/auth.
// Single-user and fully offline.

const profile = {
  get: () => {
    const users = localStorageClient.list("User");

    if (users.length > 0) {
      return users[0];
    }

    return localStorageClient.create("User", {
      full_name: "Student",
      email: "",
    });
  },

  update: (data) => {
    const current = profile.get();

    return localStorageClient.update(
      "User",
      current.id,
      data
    );
  },
};

// ─── Offline Fallback Generators ───────────────────────────────────────────

function offlineEvaluateCardAnswer(args = {}) {
  const expected = String(args.expectedAnswer || "").toLowerCase();
  const answer = String(args.studentAnswer || "").toLowerCase();
  const words = expected.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  const unique = [...new Set(words)];
  const hits = unique.filter((w) => answer.includes(w)).length;
  const correctness = unique.length ? Math.min(1, hits / Math.max(1, Math.ceil(unique.length * 0.55))) : 0;
  const rating = correctness >= 0.86 ? "easy" : correctness >= 0.62 ? "good" : correctness >= 0.35 ? "hard" : "again";
  const levels = { easy: 0, medium: 1, hard: 2 };
  const rank = levels[String(args.difficulty || "medium")] ?? 1;
  const next = correctness >= 0.86 ? Math.min(2, rank + 1) : correctness >= 0.62 ? rank : Math.max(0, rank - 1);
  return {
    correctness,
    rating,
    feedback: correctness >= 0.62 ? "Your answer covers the main idea." : "Review the key points and try the concept again.",
    missing_points: [],
    model_answer: args.expectedAnswer || "",
    next_difficulty: next === 0 ? "easy" : next === 2 ? "hard" : "medium",
    offline: true,
  };
}

function offlineGenerateCards(args = {}) {
  const sourceText = (args.sourceText || "").trim();
  const majorTopic = args.majorTopic || args.topic || "General Study";
  const count = Math.max(1, Math.min(Number(args.count) || 5, 20));

  const sentences = sourceText
    ? sourceText.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 15)
    : [];

  const cards = [];
  const totalCards = Math.max(1, Math.min(count, Math.max(sentences.length, count)));

  for (let i = 0; i < totalCards; i++) {
    const sentence = sentences[i] || `Fundamental theory and governing mechanisms of ${majorTopic} concept ${i + 1}.`;
    const subtopic = sentence.split(/[:–—]/)[0]?.slice(0, 50) || `${majorTopic} Concept ${i + 1}`;

    const front = `Explain the foundational theory, mathematical formulation, and problem-solving application of ${subtopic}.`;
    const back = `### 1. Foundational Concept & Intuition
${sentence}
${subtopic} is an essential cornerstone in ${majorTopic}. It governs how system variables interact under theoretical and practical constraints.

### 2. Core Formula & Mathematical Derivation
Key relationship:
$$f(x) = k \\cdot \\frac{\\Delta y}{\\Delta t}$$
where all parameters must be evaluated strictly under standard reference conditions.

### 3. Step-by-Step Problem Application
- **Step 1**: Identify known parameters and boundary states from the problem statement.
- **Step 2**: Apply governing equations for ${subtopic} and check unit consistency.
- **Step 3**: Verify limiting conditions to guarantee physical/mathematical validity.

### 4. Nuances & Edge Cases
Ensure correct sign conventions and note that this relationship holds primarily within standard operating regimes.`;

    const keyPoints = [
      `Foundational principle and definition of ${subtopic}`,
      `Core equations, boundary states, and unit consistency in ${majorTopic}`,
      `Systematic 3-step application workflow for exam/practice problems`,
    ];
    const commonConfusion = `Guard against mixing up state conditions or applying equations outside their valid linear/standard domain for ${subtopic}.`;

    cards.push({
      id: `card_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      card_type: "learning",
      title: subtopic,
      subtopic: subtopic,
      major_topic: majorTopic,
      front,
      back,
      key_points: keyPoints,
      common_confusion: commonConfusion,
      difficulty: i % 3 === 0 ? "hard" : i % 3 === 1 ? "medium" : "easy",
      learning_goal: `Master theory and application for ${subtopic}.`,
      learning_content: back,
      question: front,
      active_recall_prompt: front,
      answer: back,
      explanation: back,
      why_it_matters: commonConfusion,
      subject_id: args.subject_id || null,
      topic_id: args.topic_id || null,
      assignment_id: args.assignment_id || null,
    });
  }

  return { cards };
}

function offlineGenerateQuiz(args = {}) {
  const topic = args.topic || args.majorTopic || "General Study";
  const instructions = String(args.customInstructions || args.promptText || '').toLowerCase();
  const isObjectiveOnly = /\b(all|only|just|purely|\d+)?\s*(objective|mcq|mcqs|multiple[ -]?choice)\b/i.test(instructions) ||
                          /\bobjective\s*(paper|quiz|questions?|set|test|hi)\b/i.test(instructions);

  if (isObjectiveOnly) {
    return {
      questions: [
        {
          id: `quiz_${Date.now()}_0`,
          type: "multiple_choice",
          question: `Which core principle best defines ${topic}?`,
          options: [
            `Key foundational concept of ${topic}`,
            `Incorrect alternative theory`,
            `Unrelated physical phenomenon`,
            `None of the above`
          ],
          answer: `Key foundational concept of ${topic}`,
          explanation: `Comprehensive breakdown of ${topic} explaining why this option is correct.`,
          difficulty: "medium"
        },
        {
          id: `quiz_${Date.now()}_1`,
          type: "multiple_choice",
          question: `Which statement accurately describes ${topic}?`,
          options: [
            `Standard theoretical rule governing ${topic}`,
            `Speculative unverified claim`,
            `Outdated historical hypothesis`,
            `Unrelated mathematical formulation`
          ],
          answer: `Standard theoretical rule governing ${topic}`,
          explanation: `Detailed conceptual explanation for ${topic}.`,
          difficulty: "medium"
        }
      ]
    };
  }

  return {
    questions: [
      {
        id: `quiz_${Date.now()}_0`,
        type: "subjective",
        question: `Explain the foundational concept and core principles of ${topic}. Derive key formulas where applicable.`,
        options: [],
        answer: `The core theory of ${topic} relies on fundamental conservation principles and systematic mathematical relationships.`,
        explanation: `Comprehensive conceptual breakdown of ${topic} highlighting key derivations.`,
        difficulty: "medium"
      },
      {
        id: `quiz_${Date.now()}_1`,
        type: "multiple_choice",
        question: `Which statement accurately describes the foundational theory of ${topic}?`,
        options: [
          `A foundational theoretical concept in ${topic}`,
          `An unverified speculative claim`,
          `An unrelated empirical observation`,
          `A superseded historical hypothesis`
        ],
        answer: `A foundational theoretical concept in ${topic}`,
        explanation: `This option correctly represents the core theoretical definition of ${topic}.`,
        difficulty: "medium"
      }
    ]
  };
}

function offlineGenerateQuickCheck(args = {}) {
  const topic = args.topic || "this topic";

  return {
    questions: [
      {
        type: "multiple_choice",
        question: `Which best describes "${topic}"?`,
        options: [
          "A foundational concept worth reviewing",
          "An unrelated topic",
          "A type of software",
          "None of the above",
        ],
        answer_index: 0,
        explanation:
          "Offline quick-check: review your notes.",
      },

      {
        type: "multiple_choice",
        question: `How confident are you with "${topic}"?`,
        options: [
          "Very confident",
          "Somewhat confident",
          "Need review",
          "Not familiar",
        ],
        answer_index: 2,
        explanation:
          "Offline mode — use this to self-assess.",
      },
    ],
  };
}

function offlineExplainConcept(args = {}) {
  const concept = args.concept || "this concept";
  const depth = args.depth || "deeper";

  return {
    summary: `"${concept}" — offline explanation (${depth}). Connect this to your notes and learning cards for a complete picture.`,

    key_points: [
      "Review your existing notes on this topic",
      "Create learning cards to reinforce understanding",
      "Use Focus sessions to study this concept deeply",
    ],

    analogy:
      "Think of it like building blocks — each concept supports the next.",

    example:
      "Apply this concept to a problem from your assignments.",

    related_concepts: [],
  };
}

function offlineTeachStep(args = {}) {
  const concept = args.concept || "this concept";
  const step = args.step || 0;

  if (step === 0) {
    return {
      evaluation:
        `Let's explore "${concept}" together.`,

      correct_points: [],

      missing_points: [],

      explanation:
        `In offline mode, I'll guide you through self-reflection. In your own words, what do you already know about "${concept}"?`,

      follow_up_question:
        `What is the most important thing to understand about ${concept}?`,

      is_complete: false,
    };
  }

  return {
    evaluation:
      "Good effort! Review your notes to fill any gaps.",

    correct_points: [
      "You engaged with the material",
    ],

    missing_points: [
      "Check your notes for complete coverage",
    ],

    explanation:
      "Offline tutoring is limited — use your learning cards for targeted practice.",

    follow_up_question:
      "Would you like to review your cards on this topic?",

    is_complete: step >= 3,
  };
}

function offlineExploreTopic(args = {}) {
  const concept = args.topic || "this topic";

  return {
    return_note:
      "Offline exploration — results are limited. Add detailed notes to enrich your study path.",

    concepts: [
      {
        name: `${concept} — fundamentals`,
        description:
          "Review the core principles from your notes.",
        relationship:
          args.direction || "broader",
        why_interesting:
          "Foundational knowledge for mastery.",
      },

      {
        name: `${concept} — applications`,
        description:
          "How this concept applies in practice.",
        relationship: "application",
        why_interesting:
          "Real-world context aids retention.",
      },
    ],
  };
}

// ─── Offline Recommendation ────────────────────────────────────────────────

function offlineRecommend() {
  const subjects =
    localStorageClient.list("Subject");

  const assignments =
    localStorageClient.list("Assignment");

  if (subjects.length === 0) {
    return null;
  }

  const subject = subjects[0];

  /*
   * Support both the newer `status` model and the
   * older `completed` boolean.
   */
  const pending = assignments.filter(
    (a) =>
      a.subject_id === subject.id &&
      a.completed !== true &&
      a.status !== "graded"
  );

  const assignment =
    pending[0] || assignments[0];

  return {
    result: {
      headline:
        "Continue building your knowledge",

      reasons: [
        "Consistent daily study builds mastery faster than cramming",

        "Review sessions reinforce long-term retention",

        assignment
          ? "You have pending assignments to work on"
          : "Explore your subjects to add topics",
      ],

      encouragement:
        "Small steps every day lead to big results. You've got this!",
    },

    signals: {
      subject_id: subject.id,

      subjectName: subject.name,

      assignment_id:
        assignment?.id || null,

      topicName:
        assignment?.title || "General study",

      actionTitle:
        "Review and study",

      mastery: 0,

      recommendedDuration: 25,

      daysUntilDeadline:
        assignment?.due_date
          ? Math.max(
              0,
              Math.ceil(
                (new Date(assignment.due_date) -
                  new Date()) /
                  86400000
              )
            )
          : 7,
    },
  };
}

// ─── AI Functions ──────────────────────────────────────────────────────────

const functions = {
  invoke: async (name, args = {}) => {
    if (name !== "learningCoach") {
      return {
        data: {
          result: null,
        },
      };
    }

    const op = args.operation;

    const aiEnabled = await isAIConfigured();

    try {
      // ── Generate Cards ─────────────────────────────────────────────────

      if (op === "generateCards") {
        if (aiEnabled) {
          const result = await aiGenerateCards(args);
          if (result) return { data: { result } };
        }
        return { data: { result: offlineGenerateCards(args) } };
      }

      if (op === "generateQuiz") {
        if (aiEnabled) {
          const result = await aiGenerateQuiz(args);
          if (result) return { data: { result } };
        }
        return { data: { result: offlineGenerateQuiz(args) } };
      }

      // ── Evaluate written flashcard answer ─────────────────────────────

      if (op === "evaluateCardAnswer") {
        if (aiEnabled) {
          const result = await aiEvaluateCardAnswer(args);
          if (result) return { data: { result } };
        }

        return {
          data: {
            result: offlineEvaluateCardAnswer(args),
          },
        };
      }

      // ── Generate Quick Check ───────────────────────────────────────────

      if (op === "generateQuickCheck") {
        if (aiEnabled) {
          const result =
            await aiGenerateQuickCheck(args);

          if (result) {
            return {
              data: {
                result,
              },
            };
          }
        }

        return {
          data: {
            result:
              offlineGenerateQuickCheck(args),
          },
        };
      }

      // ── Explain Concept ────────────────────────────────────────────────

      if (op === "explainConcept") {
        if (aiEnabled) {
          const result =
            await aiExplainConcept(args);

          if (result) {
            return {
              data: {
                result,
              },
            };
          }
        }

        return {
          data: {
            result:
              offlineExplainConcept(args),
          },
        };
      }

      // ── Teach Step ─────────────────────────────────────────────────────

      if (op === "teachStep") {
        if (aiEnabled) {
          const result =
            await aiTeachStep(args);

          if (result) {
            return {
              data: {
                result,
              },
            };
          }
        }

        return {
          data: {
            result:
              offlineTeachStep(args),
          },
        };
      }

      // ── Explore Topic ──────────────────────────────────────────────────

      if (op === "exploreTopic") {
        if (aiEnabled) {
          const result =
            await aiExploreTopic(args);

          if (result) {
            return {
              data: {
                result,
              },
            };
          }
        }

        return {
          data: {
            result:
              offlineExploreTopic(args),
          },
        };
      }

      // ── Recommend ──────────────────────────────────────────────────────

      if (op === "recommend") {
        if (aiEnabled) {
          const result = await aiRecommend({
            context: {
              subjects:
                localStorageClient
                  .list("Subject")
                  .map((s) => ({
                    id: s.id,
                    name: s.name,
                  })),

              assignments:
                localStorageClient
                  .list("Assignment")
                  .filter(
                    (a) =>
                      a.completed !== true &&
                      a.status !== "graded"
                  )
                  .map((a) => ({
                    id: a.id,
                    title: a.title,
                    due_date: a.due_date,
                    subject_id: a.subject_id,
                    status: a.status,
                    priority: a.priority,
                    estimated_hours:
                      a.estimated_hours,
                  })),

              topics:
                localStorageClient
                  .list("Topic")
                  .map((t) => ({
                    id: t.id,
                    name: t.name,
                    subject_id:
                      t.subject_id,
                  })),

              recentLearningEvents:
                localStorageClient
                  .list(
                    "LearningEvent",
                    "-created_date",
                    100
                  ).length,
            },
          });

          if (result) {
            return {
              data: result,
            };
          }
        }

        const offline =
          offlineRecommend();

        return {
          data:
            offline || {
              result: null,
              signals: null,
            },
        };
      }

      // ── Chat ───────────────────────────────────────────────────────────

      if (op === "chat") {
        if (aiEnabled) {
          const result = await aiChat(
            args.message,
            args.history || [],
            args.context || {},
            args.imageDataUrl || null
          );

          if (result) {
            return {
              data: {
                result,
              },
            };
          }
        }

        return {
          data: {
            result: {
              reply:
                "AI chat is not configured. Go to Profile → AI Settings to connect an AI provider.",
            },
          },
        };
      }

      return {
        data: {
          result: null,
        },
      };
    } catch (error) {
      console.error(
        "AI operation failed:",
        error
      );

      const message =
        error?.message ||
        "AI request failed.";

      /*
       * If a real provider is configured, return
       * the actual provider error instead of hiding it.
       */
      if (aiEnabled) {
        if (op === "evaluateCardAnswer") {
          return { data: { result: offlineEvaluateCardAnswer(args), error: message } };
        }
        return {
          data: {
            result: null,
            error: message,
          },
        };
      }

      // Offline fallbacks.

      if (op === "generateCards") {
        return {
          data: {
            result: offlineGenerateCards(args),
          },
        };
      }

      if (op === "generateQuiz") {
        return {
          data: {
            result: offlineGenerateQuiz(args),
          },
        };
      }

      if (op === "generateQuickCheck") {
        return {
          data: {
            result:
              offlineGenerateQuickCheck(args),
          },
        };
      }

      if (op === "explainConcept") {
        return {
          data: {
            result:
              offlineExplainConcept(args),
          },
        };
      }

      if (op === "teachStep") {
        return {
          data: {
            result:
              offlineTeachStep(args),
          },
        };
      }

      if (op === "exploreTopic") {
        return {
          data: {
            result:
              offlineExploreTopic(args),
          },
        };
      }

      if (op === "recommend") {
        return {
          data:
            offlineRecommend() || {
              result: null,
              signals: null,
            },
        };
      }

      return {
        data: {
          result: null,
          error: message,
        },
      };
    }
  },
};

// ─── Export ────────────────────────────────────────────────────────────────

export const localClient = {
  entities,
  profile,
  functions,
};

export default localClient;
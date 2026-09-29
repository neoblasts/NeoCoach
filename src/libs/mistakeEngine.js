/**
 * Local Mistake Engine for LifeOS
 *
 * Deterministic mistake classification and pattern analysis.
 * Classifies student errors locally using pattern matching and heuristics first.
 * Only forwards to AI if interpretation is genuinely ambiguous.
 */

import { localClient } from "@/api/localStorageClient";
import { logLearningEvent, EVENT_TYPES } from "./learningEvents";

export const MISTAKE_TYPES = {
  CONCEPT: "CONCEPT",         // Fundamental misunderstanding of governing theory
  FORMULA: "FORMULA",         // Wrong formula, inverted ratio, wrong laws
  CALCULATION: "CALCULATION", // Arithmetic, signs (+/-), algebra or unit conversion slips
  MEMORY: "MEMORY",           // Forgotten factual recall, missing definition
  MISREAD: "MISREAD",         // Overlooked "NOT", "EXCEPT", units, or constraints
  CARELESS: "CARELESS",       // Rushed execution, typo, swapped option
  APPLICATION: "APPLICATION", // Knew theory, failed to apply in context
  UNKNOWN: "UNKNOWN",
};

/**
 * Deterministically attempts to classify a mistake using rule-based heuristics.
 *
 * @param {Object} params
 * @param {string} params.question
 * @param {string} params.expectedAnswer
 * @param {string} params.studentAnswer
 * @param {Array<string>} [params.missingPoints]
 * @returns {{ canClassify: boolean, type: string, confidence: number, rationale: string }}
 */
export function classifyMistakeLocally({
  question = "",
  expectedAnswer = "",
  studentAnswer = "",
  missingPoints = [],
}) {
  const q = question.toLowerCase();
  const exp = expectedAnswer.toLowerCase();
  const ans = studentAnswer.toLowerCase().trim();

  // 1. Blank / Empty answer -> MEMORY
  if (!ans || ans.length < 3 || ans === "idk" || ans === "don't know" || ans === "skip") {
    return {
      canClassify: true,
      type: MISTAKE_TYPES.MEMORY,
      confidence: 0.95,
      rationale: "No answer provided — recall lapse or forgotten concept.",
    };
  }

  // 2. Misread prompt signals ("NOT", "EXCEPT", "INCORRECT", "LEAST")
  if (/\b(not|except|incorrect|false|least|unlikely|cannot)\b/i.test(question)) {
    // If student stated a TRUE property of the subject, they likely inverted the negative condition
    const words = exp.split(/\s+/).filter((w) => w.length > 4);
    const hasOppositeMatch = words.some((w) => ans.includes(w));
    if (hasOppositeMatch) {
      return {
        canClassify: true,
        type: MISTAKE_TYPES.MISREAD,
        confidence: 0.88,
        rationale: "Prompt contained negative qualifier (not/except). Student likely inverted the query constraint.",
      };
    }
  }

  // 3. Numerical / Calculation error (numbers differ by sign, power of 10, or arithmetic)
  const expNum = exp.match(/[-+]?\d*\.?\d+/g);
  const ansNum = ans.match(/[-+]?\d*\.?\d+/g);
  if (expNum && ansNum && expNum.length > 0 && ansNum.length > 0) {
    const eVal = parseFloat(expNum[0]);
    const aVal = parseFloat(ansNum[0]);
    if (!isNaN(eVal) && !isNaN(aVal)) {
      if (Math.abs(eVal + aVal) < 0.0001 && eVal !== 0) {
        return {
          canClassify: true,
          type: MISTAKE_TYPES.CALCULATION,
          confidence: 0.92,
          rationale: "Sign error (+/- polarity flipped).",
        };
      }
      if (Math.abs(eVal / aVal - 10) < 0.1 || Math.abs(aVal / eVal - 10) < 0.1) {
        return {
          canClassify: true,
          type: MISTAKE_TYPES.CALCULATION,
          confidence: 0.90,
          rationale: "Order-of-magnitude / decimal place conversion slip.",
        };
      }
      if (Math.abs(eVal - aVal) > 0 && Math.abs(eVal - aVal) < 10) {
        return {
          canClassify: true,
          type: MISTAKE_TYPES.CALCULATION,
          confidence: 0.85,
          rationale: "Arithmetic calculation discrepancy.",
        };
      }
    }
  }

  // 4. Formula / Equation errors (contains math/physics variables or formulas)
  if (/[=\^√∫∂λπθ]/.test(question) || /\b(equation|formula|law|theorem|derivative|integral)\b/i.test(q)) {
    if (missingPoints && missingPoints.some((p) => /formula|equation|constant|proportional/i.test(p))) {
      return {
        canClassify: true,
        type: MISTAKE_TYPES.FORMULA,
        confidence: 0.85,
        rationale: "Equation structure, constant, or proportionality law was inaccurate.",
      };
    }
  }

  // 5. Concept errors (fundamental mechanism or prerequisite missing)
  if (missingPoints && missingPoints.length > 0) {
    return {
      canClassify: true,
      type: MISTAKE_TYPES.CONCEPT,
      confidence: 0.80,
      rationale: `Omitted core theoretical principle: ${missingPoints[0]}`,
    };
  }

  // If none of the deterministic rules match with high confidence, request AI classification
  return {
    canClassify: false,
    type: MISTAKE_TYPES.UNKNOWN,
    confidence: 0.3,
    rationale: "Requires AI interpretation of student reasoning.",
  };
}

/**
 * Record a classified mistake and log an event
 */
export async function recordMistake({
  topicId,
  topicName,
  subjectId,
  subjectName,
  mistakeType,
  rationale,
  question,
  studentAnswer,
  expectedAnswer,
}) {
  const type = Object.values(MISTAKE_TYPES).includes(mistakeType) ? mistakeType : MISTAKE_TYPES.CONCEPT;

  await logLearningEvent({
    event_type: EVENT_TYPES.MISTAKE_DETECTED,
    topic_id: topicId,
    topic_name: topicName,
    subject_id: subjectId,
    subject_name: subjectName,
    mistake_type: type,
    is_correct: false,
    metadata: {
      rationale,
      question: question?.slice(0, 200),
      studentAnswer: studentAnswer?.slice(0, 200),
      expectedAnswer: expectedAnswer?.slice(0, 200),
    },
  });

  return { recorded: true, type, rationale };
}

/**
 * Aggregate mistake patterns for a topic or globally
 * @param {string} [topicId]
 * @returns {{ totalMistakes: number, dominantType: string, typeCounts: Object, patterns: Array<string> }}
 */
export function getMistakeAnalysis(topicId = null) {
  const events = localClient.entities.LearningEvent.list("-created_date", 500);
  const mistakeEvents = events.filter((e) => {
    if (e.event_type !== EVENT_TYPES.MISTAKE_DETECTED && e.is_correct !== false) return false;
    if (topicId && e.topic_id !== topicId) return false;
    return true;
  });

  const typeCounts = {
    [MISTAKE_TYPES.CONCEPT]: 0,
    [MISTAKE_TYPES.FORMULA]: 0,
    [MISTAKE_TYPES.CALCULATION]: 0,
    [MISTAKE_TYPES.MEMORY]: 0,
    [MISTAKE_TYPES.MISREAD]: 0,
    [MISTAKE_TYPES.CARELESS]: 0,
    [MISTAKE_TYPES.APPLICATION]: 0,
    [MISTAKE_TYPES.UNKNOWN]: 0,
  };

  mistakeEvents.forEach((e) => {
    const t = e.mistake_type || MISTAKE_TYPES.CONCEPT;
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  let dominantType = MISTAKE_TYPES.CONCEPT;
  let maxCount = 0;
  Object.entries(typeCounts).forEach(([type, count]) => {
    if (count > maxCount) {
      maxCount = count;
      dominantType = type;
    }
  });

  const patterns = [];
  if (typeCounts[MISTAKE_TYPES.CALCULATION] >= 3) patterns.push("Calculation / arithmetic slips in numerical problems");
  if (typeCounts[MISTAKE_TYPES.CONCEPT] >= 3) patterns.push("Conceptual mechanism misunderstanding");
  if (typeCounts[MISTAKE_TYPES.FORMULA] >= 2) patterns.push("Formula application errors");
  if (typeCounts[MISTAKE_TYPES.MISREAD] >= 2) patterns.push("Overlooking prompt constraints (NOT/EXCEPT)");
  if (typeCounts[MISTAKE_TYPES.MEMORY] >= 3) patterns.push("Factual recall lapses");

  return {
    totalMistakes: mistakeEvents.length,
    dominantType,
    typeCounts,
    patterns,
  };
}

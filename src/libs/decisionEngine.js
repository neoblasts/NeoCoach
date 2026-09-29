/**
 * Local Next-Best-Action Decision Engine for LifeOS
 *
 * Deterministically computes the highest-leverage study action for the student.
 * Multi-factor heuristic scoring based entirely on local state:
 * - Overdue flashcards (Spaced Repetition urgency)
 * - Weak / Forgotten topics (< 50% mastery, high exam importance)
 * - Upcoming exam / assignment deadlines
 * - Recent mistake clustering
 * - Unstudied prerequisites
 *
 * Operates 100% locally. Zero AI dependency.
 */

import { localClient } from "@/api/localStorageClient";
import { buildKnowledgeGraph, checkPrerequisites } from "./knowledgeGraph";
import { getDueFlashcards } from "./spacedRepetition";
import { getMistakeAnalysis } from "./mistakeEngine";

export const ACTION_TYPES = {
  REVIEW_FLASHCARDS: "REVIEW_FLASHCARDS",
  PRACTICE_QUESTIONS: "PRACTICE_QUESTIONS",
  RELEARN_TOPIC: "RELEARN_TOPIC",
  MINI_QUIZ: "MINI_QUIZ",
  MOCK_EXAM: "MOCK_EXAM",
  CONTINUE_NEW_TOPIC: "CONTINUE_NEW_TOPIC",
};

/**
 * Computes the Next Best Action for the student
 * @param {Object} [existingGraph] Optional pre-built knowledge graph
 * @returns {Object} Primary recommendation + alternative actionable queue
 */
export function computeNextBestAction(existingGraph = null) {
  const graph = existingGraph || buildKnowledgeGraph();
  const dueCards = getDueFlashcards();
  const mistakeAnalysis = getMistakeAnalysis();
  const assignments = localClient.entities.Assignment.list("-due_date") || [];
  const tasks = localClient.entities.Task.list() || [];
  const subjects = Object.values(graph.subjects);
  const topics = Object.values(graph.topics);

  const candidates = [];

  // 1. Spaced Repetition Flashcard Review Candidate
  if (dueCards.length > 0) {
    const dueCount = dueCards.length;
    const priorityScore = 80 + Math.min(20, dueCount * 2);
    candidates.push({
      type: ACTION_TYPES.REVIEW_FLASHCARDS,
      score: priorityScore,
      title: `Review ${dueCount} Due Flashcard${dueCount > 1 ? "s" : ""}`,
      subtitle: `${dueCount} concept cards ready for spaced repetition recall.`,
      topicName: dueCards[0]?.title || dueCards[0]?.subtopic || "Theory Deck",
      subjectName: dueCards[0]?.subject_id ? graph.subjects[dueCards[0].subject_id]?.name || "General" : "Spaced Recall",
      durationMinutes: Math.min(30, Math.max(5, Math.ceil(dueCount * 1.5))),
      urgency: dueCount > 10 ? "high" : "medium",
      badge: "Spaced Repetition",
      reasons: [
        `${dueCount} cards have reached their scheduled review interval.`,
        "Timely review prevents memory decay in long-term retention.",
      ],
      action: {
        type: "navigate",
        url: "/learn?tab=cards",
        label: "Start Flashcard Review",
      },
    });
  }

  // 2. Weak Topic Relearn Candidate
  const weakTopics = topics
    .filter((t) => t.stage === "WEAK" || t.stage === "FORGOTTEN" || (t.mastery < 50 && t.attempts > 0))
    .sort((a, b) => {
      // Prioritize high exam importance, then lowest mastery
      const impWeight = { high: 3, medium: 2, low: 1 };
      const aWeight = (impWeight[a.examImportance] || 2) * 100 - a.mastery;
      const bWeight = (impWeight[b.examImportance] || 2) * 100 - b.mastery;
      return bWeight - aWeight;
    });

  if (weakTopics.length > 0) {
    const target = weakTopics[0];
    const prereqCheck = checkPrerequisites(target.id, graph);
    
    let topicToStudy = target;
    let reasonText = `Mastery is ${target.mastery}% with ${target.mistakeCount} recorded mistakes.`;
    
    if (!prereqCheck.satisfied && prereqCheck.missing.length > 0) {
      topicToStudy = prereqCheck.missing[0];
      reasonText = `Prerequisite for "${target.name}" needs reinforcement first (${topicToStudy.name}: ${topicToStudy.mastery}% mastery).`;
    }

    candidates.push({
      type: ACTION_TYPES.RELEARN_TOPIC,
      score: 85 + (target.examImportance === "high" ? 12 : 5),
      title: `Reinforce ${topicToStudy.name}`,
      subtitle: `${topicToStudy.subjectName} · ${topicToStudy.chapter || "Core Theory"}`,
      topicId: topicToStudy.id,
      topicName: topicToStudy.name,
      subjectId: topicToStudy.subjectId,
      subjectName: topicToStudy.subjectName,
      durationMinutes: 20,
      urgency: "high",
      badge: "Weak Topic",
      reasons: [
        reasonText,
        target.examImportance === "high" ? "High importance for upcoming examinations." : "Reinforce foundation before attempting advanced problems.",
      ],
      action: {
        type: "focus",
        subjectId: topicToStudy.subjectId,
        topicId: topicToStudy.id,
        label: `Start Concept Review (${topicToStudy.name})`,
      },
    });
  }

  // 3. Urgent Assignment / Exam Candidate
  const now = new Date();
  const urgentAssignments = assignments.filter((a) => {
    if (a.completed || a.status === "graded" || a.status === "done" || !a.due_date) return false;
    const diffDays = (new Date(a.due_date) - now) / 86400000;
    return diffDays <= 3;
  }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  if (urgentAssignments.length > 0) {
    const asg = urgentAssignments[0];
    const daysLeft = Math.max(0, Math.ceil((new Date(asg.due_date) - now) / 86400000));
    const subj = graph.subjects[asg.subject_id];

    candidates.push({
      type: ACTION_TYPES.PRACTICE_QUESTIONS,
      score: 95 - daysLeft * 5, // Top priority if due tomorrow
      title: `Assignment: ${asg.title}`,
      subtitle: `${subj?.name || "Academic"} · Due in ${daysLeft === 0 ? "today" : `${daysLeft}d`}`,
      subjectName: subj?.name || "Assignment",
      subjectId: asg.subject_id,
      durationMinutes: 25,
      urgency: daysLeft <= 1 ? "high" : "medium",
      badge: "Deadline Approaching",
      reasons: [
        `Due date is ${daysLeft === 0 ? "today" : `in ${daysLeft} days`}.`,
        "Work in focused intervals to finish early without cramming.",
      ],
      action: {
        type: "navigate",
        url: "/assignments",
        label: "Open Assignment",
      },
    });
  }

  // 4. Practice Quiz for In-Progress Topic
  const learningTopics = topics.filter((t) => t.stage === "LEARNING" && t.attempts > 0);
  if (learningTopics.length > 0) {
    const target = learningTopics[0];
    candidates.push({
      type: ACTION_TYPES.MINI_QUIZ,
      score: 70,
      title: `Practice Quiz: ${target.name}`,
      subtitle: `Test understanding & cement active recall (${target.attempts} attempts so far).`,
      topicName: target.name,
      subjectName: target.subjectName,
      durationMinutes: 15,
      urgency: "medium",
      badge: "Targeted Practice",
      reasons: [
        `Active recall quiz to push mastery from ${target.mastery}% towards 90%.`,
        "Tests retrieval strength and pinpoints remaining formula gaps.",
      ],
      action: {
        type: "navigate",
        url: "/learn?tab=quiz",
        label: "Start Practice Quiz",
      },
    });
  }

  // 5. Default fallback: Continue New Topic or General Study
  if (candidates.length === 0) {
    const newTopic = topics.find((t) => t.stage === "NEW") || topics[0];
    const subj = newTopic?.subjectId ? graph.subjects[newTopic.subjectId] : subjects[0];

    candidates.push({
      type: ACTION_TYPES.CONTINUE_NEW_TOPIC,
      score: 50,
      title: newTopic ? `Begin ${newTopic.name}` : "Start Daily Focus Session",
      subtitle: subj?.name || "General Study",
      topicName: newTopic?.name || "Theory Session",
      subjectName: subj?.name || "Study Session",
      durationMinutes: 25,
      urgency: "low",
      badge: "New Topic",
      reasons: [
        "All flashcards are up to date and no weak topics are pending.",
        "Advance your syllabus with a fresh concept.",
      ],
      action: {
        type: "focus",
        subjectId: subj?.id || null,
        topicId: newTopic?.id || null,
        label: "Start Focus Session",
      },
    });
  }

  // Sort by calculated priority score descending
  candidates.sort((a, b) => b.score - a.score);

  return {
    primary: candidates[0],
    queue: candidates.slice(1, 4),
    mistakePattern: mistakeAnalysis.dominantType,
  };
}

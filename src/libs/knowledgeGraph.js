/**
 * Local Knowledge Graph Engine for LifeOS
 *
 * Models the academic syllabus as a DAG (Directed Acyclic Graph):
 * SUBJECT -> CHAPTER -> TOPIC -> SUBTOPIC -> PREREQUISITES
 *
 * Source of truth is entirely local.
 * Never dumps the entire graph to AI — extracts minimal focused subgraphs on demand.
 */

import { localClient } from "@/api/localStorageClient";
import { computeTopicMastery } from "./masteryEngine";

/**
 * Builds the comprehensive local knowledge graph from stored entities & events
 * @returns {Object} Graph representation
 */
export function buildKnowledgeGraph() {
  const subjects = localClient.entities.Subject.list() || [];
  const topics = localClient.entities.Topic.list() || [];
  const cards = localClient.entities.LearningCard.list() || [];
  const events = localClient.entities.LearningEvent.list() || [];

  // Pre-index events by topic for O(1) lookup
  const eventsByTopic = new Map();
  events.forEach((e) => {
    const tid = e.topic_id || e.metadata?.topic_id;
    if (tid) {
      if (!eventsByTopic.has(tid)) eventsByTopic.set(tid, []);
      eventsByTopic.get(tid).push(e);
    }
  });

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const graph = {
    subjects: {},
    topics: {},
    prerequisiteMap: {},
    adjacencyList: {},
    stats: {
      totalSubjects: subjects.length,
      totalTopics: topics.length,
      masteredCount: 0,
      weakCount: 0,
      learningCount: 0,
      averageMastery: 0,
    },
  };

  let totalMasterySum = 0;

  // 1. Process Topics & compute local mastery nodes
  topics.forEach((topic) => {
    const topicEvents = eventsByTopic.get(topic.id) || [];
    const masteryData = computeTopicMastery(topic.id, topicEvents, cards);
    const subject = subjectMap.get(topic.subject_id);

    const node = {
      id: topic.id,
      name: topic.name,
      chapter: topic.chapter || topic.unit || "Core Concepts",
      subjectId: topic.subject_id || null,
      subjectName: subject?.name || "General",
      subjectColor: subject?.color || "#20c7c9",
      difficulty: topic.difficulty || "medium",
      examImportance: topic.exam_importance || topic.priority || "medium", // high | medium | low
      prerequisites: Array.isArray(topic.prerequisites) ? topic.prerequisites : [],
      subtopics: Array.isArray(topic.subtopics) ? topic.subtopics : [],
      
      // Dynamic local learning state
      mastery: masteryData.score,
      stage: masteryData.stage, // NEW | LEARNING | WEAK | STRONG | FORGOTTEN | MASTERED
      confidence: masteryData.confidence,
      accuracy: masteryData.accuracy,
      recentAccuracy: masteryData.recentAccuracy,
      attempts: masteryData.attempts,
      mistakeCount: masteryData.incorrectAttempts,
      mistakeFrequency: masteryData.mistakeFrequency,
      retentionScore: masteryData.retentionScore,
      lastReviewed: masteryData.lastReviewed,
      daysSinceReview: masteryData.daysSinceReview,
      nextReviewDate: masteryData.nextReviewDate,
      isDueForReview: masteryData.isDueForReview,
    };

    graph.topics[topic.id] = node;
    totalMasterySum += node.mastery;

    if (node.stage === "MASTERED") graph.stats.masteredCount++;
    else if (node.stage === "WEAK" || node.stage === "FORGOTTEN") graph.stats.weakCount++;
    else graph.stats.learningCount++;

    // Prerequisite mapping
    if (node.prerequisites.length > 0) {
      graph.prerequisiteMap[node.id] = node.prerequisites;
      node.prerequisites.forEach((preId) => {
        if (!graph.adjacencyList[preId]) graph.adjacencyList[preId] = [];
        graph.adjacencyList[preId].push(node.id);
      });
    }
  });

  // 2. Process Subjects
  subjects.forEach((subj) => {
    const subjectTopics = Object.values(graph.topics).filter((t) => t.subjectId === subj.id);
    const subjectMastery = subjectTopics.length > 0
      ? Math.round(subjectTopics.reduce((sum, t) => sum + t.mastery, 0) / subjectTopics.length)
      : 0;

    // Group chapters
    const chapters = {};
    subjectTopics.forEach((t) => {
      if (!chapters[t.chapter]) chapters[t.chapter] = [];
      chapters[t.chapter].push(t.id);
    });

    graph.subjects[subj.id] = {
      id: subj.id,
      name: subj.name,
      color: subj.color,
      mastery: subjectMastery,
      topicCount: subjectTopics.length,
      chapters,
      topicIds: subjectTopics.map((t) => t.id),
    };
  });

  graph.stats.averageMastery = topics.length > 0 ? Math.round(totalMasterySum / topics.length) : 0;

  return graph;
}

/**
 * Check if all prerequisites of a topic are satisfied
 * @param {string} topicId
 * @param {Object} [graph]
 * @returns {{ satisfied: boolean, missing: Array<Object> }}
 */
export function checkPrerequisites(topicId, graph = null) {
  const g = graph || buildKnowledgeGraph();
  const node = g.topics[topicId];
  if (!node || !node.prerequisites || node.prerequisites.length === 0) {
    return { satisfied: true, missing: [] };
  }

  const missing = [];
  node.prerequisites.forEach((preId) => {
    const preNode = g.topics[preId];
    if (!preNode || preNode.mastery < 50) {
      missing.push(preNode || { id: preId, name: "Unknown Prerequisite", mastery: 0 });
    }
  });

  return {
    satisfied: missing.length === 0,
    missing,
  };
}

/**
 * Extracts a minimal, token-efficient subgraph payload for AI tasks.
 * ONLY includes the target topic, its direct parent chapter, immediate prerequisites, and recent error signals.
 *
 * @param {string} topicId
 * @param {Object} [options]
 * @returns {Object} Compact context payload (< 150 tokens)
 */
export function getMinimalSubgraphForAI(topicId, options = {}) {
  const g = buildKnowledgeGraph();
  const node = g.topics[topicId];
  if (!node) {
    return { topic: topicId, note: "Standalone concept" };
  }

  const prereqDetails = node.prerequisites.map((pId) => {
    const pNode = g.topics[pId];
    return pNode ? { name: pNode.name, mastery: `${pNode.mastery}%` } : null;
  }).filter(Boolean);

  return {
    subject: node.subjectName,
    chapter: node.chapter,
    topic: node.name,
    mastery: `${node.mastery}%`,
    stage: node.stage,
    recentAccuracy: `${node.recentAccuracy}%`,
    attempts: node.attempts,
    difficulty: node.difficulty,
    examImportance: node.examImportance,
    daysSinceReview: node.daysSinceReview,
    prerequisites: prereqDetails.length > 0 ? prereqDetails : undefined,
    recentMistakePattern: options.mistakeType || undefined,
  };
}

/**
 * Returns all weak or forgotten topics needing review
 * @returns {Array<Object>}
 */
export function getWeakTopics() {
  const graph = buildKnowledgeGraph();
  return Object.values(graph.topics)
    .filter((t) => t.stage === "WEAK" || t.stage === "FORGOTTEN" || (t.mastery < 50 && t.attempts > 0))
    .sort((a, b) => a.mastery - b.mastery);
}

/**
 * Returns all topics that are due for spaced repetition review
 * @returns {Array<Object>}
 */
export function getDueReviewTopics() {
  const graph = buildKnowledgeGraph();
  return Object.values(graph.topics)
    .filter((t) => t.isDueForReview)
    .sort((a, b) => b.daysSinceReview - a.daysSinceReview);
}

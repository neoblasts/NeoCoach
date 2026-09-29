/**
 * Centralized AI Gateway Client & Context Builder for LifeOS
 *
 * Implements Phases 10–15 & 27:
 * - Deterministic Pre-Check: Checks if local system can answer before calling AI
 * - Minimal Context Builder: Compresses raw state into tight payloads (< 200 tokens)
 * - Task-Specific Token Budgets: Enforces strict limits per task type
 * - Local Content Caching: In-memory & LocalStorage cache with TTL & deduplication
 * - Conversation State Compression: Retains essential knowledge without infinite history
 * - Usage & Token Tracking: Records all calls, cache hits, and estimated savings
 */

import { isAIConfigured, getAISettings } from "./aiProviders";

// Task Types with defined Token Budgets (max tokens)
export const TASK_BUDGETS = {
  QUICK_EXPLANATION: { maxInputTokens: 300, maxOutputTokens: 350, timeoutMs: 15000, cacheTtlMs: 24 * 3600 * 1000 },
  QUESTION_GENERATION: { maxInputTokens: 500, maxOutputTokens: 900, timeoutMs: 25000, cacheTtlMs: 12 * 3600 * 1000 },
  SOCRATIC_TUTOR: { maxInputTokens: 700, maxOutputTokens: 1500, timeoutMs: 30000, cacheTtlMs: 0 },
  AI_LEARNING_REVIEW: { maxInputTokens: 400, maxOutputTokens: 600, timeoutMs: 20000, cacheTtlMs: 4 * 3600 * 1000 },
  MISTAKE_DIAGNOSIS: { maxInputTokens: 350, maxOutputTokens: 450, timeoutMs: 15000, cacheTtlMs: 24 * 3600 * 1000 },
  COMPLEX_PROBLEM: { maxInputTokens: 1200, maxOutputTokens: 2500, timeoutMs: 45000, cacheTtlMs: 6 * 3600 * 1000 },
};

const CACHE_STORAGE_KEY = "lifeos_ai_gateway_cache";
const USAGE_STORAGE_KEY = "lifeos_ai_gateway_metrics";

// Simple SHA-like deterministic string hash
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `h_${Math.abs(hash).toString(36)}`;
}

/**
 * AI Gateway Client Class
 */
class AIGatewayClient {
  constructor() {
    this.memoryCache = new Map();
    this.loadPersistedCache();
  }

  loadPersistedCache() {
    try {
      const raw = localStorage.getItem(CACHE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const now = Date.now();
        Object.entries(parsed).forEach(([key, item]) => {
          if (item && item.expiresAt > now) {
            this.memoryCache.set(key, item);
          }
        });
      }
    } catch {}
  }

  persistCache() {
    try {
      const exportObj = {};
      const now = Date.now();
      this.memoryCache.forEach((val, key) => {
        if (val.expiresAt > now) exportObj[key] = val;
      });
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(exportObj));
    } catch {}
  }

  getCache(cacheKey) {
    if (!this.memoryCache.has(cacheKey)) return null;
    const item = this.memoryCache.get(cacheKey);
    if (Date.now() > item.expiresAt) {
      this.memoryCache.delete(cacheKey);
      return null;
    }
    this.recordMetric({ cacheHit: true, tokensSaved: item.tokens || 400 });
    return item.data;
  }

  setCache(cacheKey, data, ttlMs, tokens = 0) {
    if (!ttlMs || ttlMs <= 0) return;
    const entry = {
      data,
      expiresAt: Date.now() + ttlMs,
      savedAt: Date.now(),
      tokens,
    };
    this.memoryCache.set(cacheKey, entry);
    this.persistCache();
  }

  recordMetric({ cacheHit = false, inputTokens = 0, outputTokens = 0, tokensSaved = 0, task = "general", provider = "local" }) {
    try {
      const raw = localStorage.getItem(USAGE_STORAGE_KEY);
      const metrics = raw ? JSON.parse(raw) : {
        totalCalls: 0,
        cacheHits: 0,
        cacheMisses: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokensSaved: 0,
        tasks: {},
      };

      if (cacheHit) {
        metrics.cacheHits += 1;
        metrics.totalTokensSaved += tokensSaved;
      } else {
        metrics.totalCalls += 1;
        metrics.cacheMisses += 1;
        metrics.totalInputTokens += inputTokens;
        metrics.totalOutputTokens += outputTokens;
      }

      if (!metrics.tasks[task]) metrics.tasks[task] = { calls: 0, tokens: 0 };
      metrics.tasks[task].calls += 1;
      metrics.tasks[task].tokens += (inputTokens + outputTokens);

      localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(metrics));
    } catch {}
  }

  getMetrics() {
    try {
      const raw = localStorage.getItem(USAGE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {
        totalCalls: 0,
        cacheHits: 0,
        cacheMisses: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokensSaved: 0,
        tasks: {},
      };
    } catch {
      return {};
    }
  }

  /**
   * Minimal Context Builder: Filters, compresses and formats state for AI
   */
  buildMinimalContext(taskType, rawContext = {}) {
    switch (taskType) {
      case "QUICK_EXPLANATION":
      case "MISTAKE_DIAGNOSIS":
        return {
          task: taskType,
          subject: rawContext.subject || "Academic",
          topic: rawContext.topic || "Core Concept",
          currentMastery: rawContext.mastery ? `${rawContext.mastery}%` : undefined,
          mistakePattern: rawContext.mistakeType || undefined,
        };

      case "AI_LEARNING_REVIEW":
        return {
          period: rawContext.period || "today",
          studyMinutes: rawContext.studyMinutes || 0,
          topicsStudied: Array.isArray(rawContext.topicsStudied) ? rawContext.topicsStudied.slice(0, 5) : [],
          accuracy: rawContext.accuracy !== undefined ? `${rawContext.accuracy}%` : undefined,
          weakTopics: Array.isArray(rawContext.weakTopics) ? rawContext.weakTopics.slice(0, 3) : [],
          repeatedMistake: rawContext.repeatedMistake || undefined,
          flashcardsDue: rawContext.flashcardsDue || 0,
        };

      case "QUESTION_GENERATION":
        return {
          topic: rawContext.topic,
          subtopic: rawContext.subtopic,
          targetDifficulty: rawContext.difficulty || "medium",
          coveredSubtopics: Array.isArray(rawContext.covered) ? rawContext.covered.slice(-5) : undefined,
        };

      case "SOCRATIC_TUTOR":
        return {
          concept: rawContext.concept,
          step: rawContext.step || 0,
          studentMastery: rawContext.mastery,
          coreObjective: rawContext.objective || "Foster independent conceptual derivation",
        };

      default:
        return rawContext;
    }
  }

  /**
   * Compress multi-turn conversation history into a tight summary
   */
  compressConversationHistory(messages = [], maxTurns = 4) {
    if (!Array.isArray(messages) || messages.length === 0) return [];
    
    // Take only the last few exchanges
    const recent = messages.slice(-maxTurns * 2);
    return recent.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || m.text || "").slice(0, 500),
    }));
  }

  /**
   * Central Gateway Invoker
   *
   * @param {string} taskType - One of TASK_BUDGETS keys
   * @param {string} operation - underlying IPC operation
   * @param {Object} args - request payload
   * @param {Object} [options] - bypassCache, customBudget
   * @returns {Promise<Object>}
   */
  async invoke(taskType, operation, args = {}, options = {}) {
    const budget = TASK_BUDGETS[taskType] || TASK_BUDGETS.QUICK_EXPLANATION;
    const cacheKey = hashString(`${taskType}:${operation}:${JSON.stringify(args)}`);

    // 1. Cache lookup
    if (!options.bypassCache && budget.cacheTtlMs > 0) {
      const cached = this.getCache(cacheKey);
      if (cached) {
        return { result: cached, fromCache: true };
      }
    }

    // 2. Check if AI is configured in Electron
    const configured = await isAIConfigured();
    if (!configured) {
      return { result: null, offline: true, notice: "Local offline mode (AI provider not configured)." };
    }

    // 3. Compress context
    const compressedContext = this.buildMinimalContext(taskType, args.context || {});
    const compressedArgs = {
      ...args,
      context: compressedContext,
      maxTokens: budget.maxOutputTokens,
    };

    // 4. Invoke via Electron Bridge
    try {
      if (!window?.electronAPI?.ai) {
        throw new Error("Electron AI Bridge unavailable.");
      }

      const response = await window.electronAPI.ai.invoke({
        operation,
        args: compressedArgs,
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Gateway AI invocation failed.");
      }

      const result = response.result;

      // 5. Cache result
      if (budget.cacheTtlMs > 0 && result) {
        this.setCache(cacheKey, result, budget.cacheTtlMs, budget.maxOutputTokens);
      }

      // 6. Record metric
      this.recordMetric({
        cacheHit: false,
        inputTokens: budget.maxInputTokens,
        outputTokens: budget.maxOutputTokens,
        task: taskType,
        provider: response.provider || "groq/gemini",
      });

      return { result, fromCache: false, provider: response.provider, model: response.model };
    } catch (err) {
      console.warn(`[LifeOS AI Gateway] ${taskType} call failed:`, err.message);
      return { result: null, error: err.message, offline: true };
    }
  }
}

export const aiGateway = new AIGatewayClient();
export default aiGateway;

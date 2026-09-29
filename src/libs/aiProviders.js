/**
 * LifeOS AI provider bridge.
 *
 * In Electron, API calls are made in the Electron main process so provider
 * credentials are never bundled into the React renderer. In a normal browser
 * this bridge reports that AI requires the Electron desktop runtime.
 */

const PROVIDERS = {
  gemini: {
    name: "Google Gemini",
    models: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
    defaultModel: "gemini-2.5-flash",
    getKeyUrl: "https://aistudio.google.com/apikey",
    description: "Google's fast, capable multimodal AI.",
  },

  tavily: {
    name: "Tavily Web Search",
    models: ["search"],
    defaultModel: "search",
    getKeyUrl: "https://app.tavily.com/home",
    description: "Live web search used when the Study Coach needs current sources.",
  },
  groq: {
    name: "Groq",
    models: ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.6-27b"],
    defaultModel: "openai/gpt-oss-20b",
    getKeyUrl: "https://console.groq.com/keys",
    description: "Ultra-fast inference across open models.",
  },
};

const hasElectronBridge = () => Boolean(window?.electronAPI?.ai);

export async function getAISettings() {
  if (hasElectronBridge()) return window.electronAPI.ai.getSettings();

  // Browser fallback: no secrets are read from VITE_* here.
  const provider = localStorage.getItem("lifeos_ai_provider") || "offline";
  const models = {};
  Object.keys(PROVIDERS).forEach((p) => {
    models[p] = localStorage.getItem(`lifeos_ai_model_${p}`) || PROVIDERS[p].defaultModel;
  });
  return {
    provider,
    models,
    keys: {},
    keySources: Object.fromEntries(Object.keys(PROVIDERS).map((p) => [p, "none"])),
    configured: false,
  };
}

export async function saveAISettings({ provider, keys = {}, models = {} }) {
  if (hasElectronBridge()) {
    return window.electronAPI.ai.saveSettings({ provider, keys, models });
  }

  localStorage.setItem("lifeos_ai_provider", provider || "offline");
  Object.entries(models).forEach(([p, model]) => {
    if (model) localStorage.setItem(`lifeos_ai_model_${p}`, model);
  });
  return getAISettings();
}

export async function clearAIKey(provider) {
  if (hasElectronBridge()) return window.electronAPI.ai.clearKey(provider);
  return getAISettings();
}

export async function refreshAIModels(provider) {
  if (hasElectronBridge()) return window.electronAPI.ai.refreshModels(provider);
  return { ok: false, error: "Not in electron" };
}

export async function isAIConfigured() {
  const settings = await getAISettings();
  return Boolean(settings.configured && settings.provider !== "offline");
}

export async function getKeySource(provider) {
  const settings = await getAISettings();
  return settings.keySources?.[provider] || "none";
}

export { PROVIDERS };

async function invoke(operation, args = {}) {
  if (!hasElectronBridge()) {
    throw new Error("AI requires the LifeOS Electron desktop runtime. Start the app with npm run dev:electron.");
  }

  const response = await window.electronAPI.ai.invoke({ operation, args });
  if (!response?.ok) throw new Error(response?.error || "AI request failed.");
  return response.result;
}

export const aiGenerateCards = (args) => invoke("generateCards", args);
export const aiGenerateQuiz = (args) => invoke("generateQuiz", args);
export const aiEvaluateCardAnswer = (args) => invoke("evaluateCardAnswer", args);
export const aiGenerateQuickCheck = (args) => invoke("generateQuickCheck", args);
export const aiExplainConcept = (args) => invoke("explainConcept", args);
export const aiTeachStep = (args) => invoke("teachStep", args);
export const aiExploreTopic = (args) => invoke("exploreTopic", args);
export const aiRecommend = (args) => invoke("recommend", args);
export const aiChat = (message, history = [], context = {}, imageDataUrl = null) => invoke("chat", { message, history, context, imageDataUrl });

// Electron streaming bridge used by Study Coach. The callback receives tiny
// text deltas as soon as the provider produces them, keeping the UI responsive.
export const aiChatStream = (message, history = [], context = {}, imageDataUrl = null, handlers = {}) => {
  if (!hasElectronBridge() || typeof window.electronAPI.ai.stream !== "function") {
    return Promise.reject(new Error("AI streaming requires the LifeOS Electron desktop runtime."));
  }
  return new Promise((resolve, reject) => {
    window.electronAPI.ai.stream(
      { operation: "chat", args: { message, history, context, imageDataUrl } },
      {
        onChunk: (data) => handlers.onChunk?.(data),
        onDone: (data) => {
          if (data?.ok === false) {
            reject(new Error(data.error || "AI streaming request failed."));
            return;
          }
          handlers.onDone?.(data);
          resolve(data?.result || data);
        },
        onError: (data) => {
          const error = new Error(data?.error || "AI streaming request failed.");
          error.partialReply = data?.partialReply || "";
          error.errors = data?.errors || null;
          handlers.onError?.(data);
          reject(error);
        },
      }
    );
  });
};

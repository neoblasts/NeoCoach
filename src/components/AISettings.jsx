import { useEffect, useState } from "react";
import { localClient } from "@/api/localStorageClient";
import { getAISettings, saveAISettings, clearAIKey, refreshAIModels, PROVIDERS } from "@/libs/aiProviders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/libs/utils";
import { Sparkles, Check, ExternalLink, AlertCircle, Loader2, Lock, KeyRound, Trash2, RefreshCw, Cpu } from "lucide-react";

export default function AISettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({ provider: "offline", keys: {}, models: {}, keySources: {}, configured: false, availableModels: {}, discoveredModels: {}, lastDiscoveryDate: null });
  const [draftKey, setDraftKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const load = async () => setSettings(await getAISettings());

  useEffect(() => { load(); }, []);

  const selectProvider = (provider) => {
    setSettings({ ...settings, provider });
    setDraftKey("");
    setTestResult(null);
  };

  const handleSave = async () => {
    const keys = {};
    if (draftKey.trim()) keys[settings.provider] = draftKey.trim();
    const next = await saveAISettings({ provider: settings.provider, keys, models: settings.models });
    setSettings(next);
    setDraftKey("");
    const active = settings.provider !== "offline" ? PROVIDERS[settings.provider]?.name : "Offline";
    toast({ title: "AI settings saved", description: `${active} mode is ready.` });
  };

  const handleClearKey = async () => {
    if (settings.provider === "offline") return;
    const next = await clearAIKey(settings.provider);
    setSettings(next);
    setDraftKey("");
    toast({ title: "API key removed", description: `${PROVIDERS[settings.provider].name} local credential cleared.` });
  };

  const handleDiscoverModels = async () => {
    if (settings.provider === "offline") return;
    setDiscovering(true);
    try {
      const res = await refreshAIModels(settings.provider);
      const updated = await getAISettings();
      setSettings(updated);
      const list = updated.availableModels?.[settings.provider] || [];
      toast({
        title: "Free models discovered!",
        description: `Found ${list.length} available models for ${PROVIDERS[settings.provider]?.name || settings.provider}.`,
      });
    } catch (err) {
      toast({
        title: "Discovery failed",
        description: err.message || "Could not fetch available models.",
        variant: "destructive",
      });
    } finally {
      setDiscovering(false);
    }
  };

  const handleTest = async () => {
    await handleSave();
    setTesting(true);
    setTestResult(null);
    try {
      const res = await localClient.functions.invoke("learningCoach", {
        operation: "explainConcept", concept: "photosynthesis", depth: "simpler",
      });
      if (res.data?.error) throw new Error(res.data.error);
      if (res.data?.result?.summary) setTestResult({ success: true, message: "AI is working. Response received." });
      else setTestResult({ success: false, message: "Provider responded, but no usable response was returned." });
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const selected = settings.provider !== "offline" ? PROVIDERS[settings.provider] : null;
  const source = selected ? settings.keySources?.[settings.provider] : "none";
  const configured = selected && settings.keys?.[settings.provider];

  const providerModels = [
    ...(settings.availableModels?.[settings.provider] || []),
    ...(selected?.models || []),
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-bold">AI Study Coach Settings</h3>
      </div>

      <div>
        <Label className="mb-2 block">AI Provider</Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <button onClick={() => selectProvider("offline")} className={cn("rounded-xl border p-4 text-left transition-colors", settings.provider === "offline" ? "border-primary bg-primary/5" : "hover:bg-accent")}>
            <p className="text-sm font-semibold">Offline Mode</p>
            <p className="mt-0.5 text-xs text-muted-foreground">No network or API key required. Core LifeOS data stays local.</p>
          </button>
          {Object.entries(PROVIDERS).map(([key, provider]) => (
            <button key={key} onClick={() => selectProvider(key)} className={cn("rounded-xl border p-4 text-left transition-colors", settings.provider === key ? "border-primary bg-primary/5" : "hover:bg-accent")}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{provider.name}</p>
                {settings.keys?.[key] && <Check className="h-4 w-4 text-emerald-500" />}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{provider.description}</p>
              {settings.keySources?.[key] === "env" && <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Lock className="h-3 w-3" /> Key from local .env</div>}
              {settings.keySources?.[key] === "local" && <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400"><KeyRound className="h-3 w-3" /> Encrypted local key</div>}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold">{selected.name} Configuration</h4>
            <a href={selected.getKeyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">Get API key <ExternalLink className="h-3 w-3" /></a>
          </div>

          <div className={cn("flex items-center gap-2 rounded-lg p-3 text-sm", configured ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400")}>
            {configured ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {configured ? `Credential available (${source === "env" ? "local .env" : "encrypted local storage"}).` : "No credential configured for this provider."}
          </div>

          <div>
            <Label className="mb-1.5 block">API Key {configured ? "(optional override)" : ""}</Label>
            <Input type="password" value={draftKey} onChange={(e) => setDraftKey(e.target.value)} placeholder={configured ? "Leave blank to keep the existing key" : `Paste your ${selected.name} API key`} className="h-10" autoComplete="off" />
            <p className="mt-1.5 text-xs text-muted-foreground">Keys entered here are stored by Electron using OS-backed encryption when available. They are not put into the React bundle.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="block">Model ({providerModels.length} models available)</Label>
              {configured && (
                <button
                  type="button"
                  onClick={handleDiscoverModels}
                  disabled={discovering}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <RefreshCw className={cn("h-3 w-3", discovering && "animate-spin")} />
                  {discovering ? "Searching..." : "Search for free models"}
                </button>
              )}
            </div>
            <select value={settings.models?.[settings.provider] || selected.defaultModel} onChange={(e) => setSettings({ ...settings, models: { ...settings.models, [settings.provider]: e.target.value } })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm outline-none focus:border-ring">
              {providerModels.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Cpu className="h-3 w-3 text-primary" />
              <span>
                Daily auto-discovery: {settings.lastDiscoveryDate ? `Last checked ${settings.lastDiscoveryDate}` : "Active on launch"} ({providerModels.length} free models ready)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} size="sm" className="rounded-full">Save settings</Button>
            <Button onClick={handleTest} variant="outline" size="sm" className="gap-1.5 rounded-full" disabled={testing}>
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Test connection
            </Button>
            {source === "local" && <Button onClick={handleClearKey} variant="outline" size="sm" className="gap-1.5 rounded-full text-rose-500 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Remove key</Button>}
          </div>

          {testResult && <div className={cn("flex items-center gap-2 rounded-lg p-3 text-sm", testResult.success ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400")}>
            {testResult.success ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {testResult.message}
          </div>}
        </div>
      )}

      <div className={cn("flex items-center gap-2 rounded-lg p-3 text-sm", settings.configured && settings.provider !== "offline" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400")}>
        {settings.configured && settings.provider !== "offline" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        {settings.configured && settings.provider !== "offline" ? `AI active: ${PROVIDERS[settings.provider]?.name}.` : "Offline mode. Connect an AI provider for the full Study Coach."}
      </div>

      {settings.provider === "offline" && <Button onClick={handleSave} size="sm" className="rounded-full">Save offline mode</Button>}

      <details className="rounded-xl border bg-muted/30 p-4">
        <summary className="cursor-pointer text-sm font-medium">Optional development .env setup</summary>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p>For local development, Electron can read provider keys from a project-root <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env</code>. Use non-Vite names so secrets are never exposed to the React bundle.</p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs"><code>{`GEMINI_API_KEY="your-gemini-key"
GROQ_API_KEY="your-groq-key"

GEMINI_MODEL="gemini-2.5-flash"
GROQ_MODEL="openai/gpt-oss-120b"`}</code></pre>
          <p className="text-xs">Do not commit this file. For packaged LifeOS builds, configure the key from this screen instead.</p>
        </div>
      </details>
    </div>
  );
}

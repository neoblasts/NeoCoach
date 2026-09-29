/**
 * ApiKeySetup — Post-login profile setup page.
 *
 * Shown immediately after login/signup.
 * User MUST save Gemini AND Groq keys to proceed.
 * Tavily is optional (shown with "Optional" badge).
 * Once all 3 required keys are saved, "Enter LifeOS" button unlocks.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getAISettings, saveAISettings, PROVIDERS } from "@/libs/aiProviders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/libs/utils";
import {
  Brain, Eye, EyeOff, ExternalLink, CheckCircle2,
  AlertCircle, Loader2, LogOut, Sparkles, KeyRound,
  ArrowRight, Lock, Unlock,
} from "lucide-react";

// Supported providers (Gemini and Groq)
const REQUIRED = ["gemini", "groq"];

const CARD = {
  gemini: {
    label:       "Google Gemini",
    description: "Vision, math, and multimodal reasoning (Gemini 3.7 / 3.6 / 3.8 / 3.5). Powers image analysis and tutoring.",
    badge:       "Recommended",
    badgeColor:  "bg-blue-500/15 text-blue-400 border-blue-500/20",
    accent:      "border-blue-500/30 hover:border-blue-500/50",
    glow:        "shadow-blue-500/10",
    iconColor:   "text-blue-400",
    getKeyUrl:   "https://aistudio.google.com/apikey",
    placeholder: "AIza...",
  },
  groq: {
    label:       "Groq",
    description: "Ultra-fast inference (GPT-OSS 120B / 20B). Used for deep reasoning, chat, and rapid generation.",
    badge:       "Required",
    badgeColor:  "bg-orange-500/15 text-orange-400 border-orange-500/20",
    accent:      "border-orange-500/30 hover:border-orange-500/50",
    glow:        "shadow-orange-500/10",
    iconColor:   "text-orange-400",
    getKeyUrl:   "https://console.groq.com/keys",
    placeholder: "gsk_...",
  },
};

function ProviderCard({ id, meta, isSaved, draft, setDraft, showKey, toggleShow, onSave, saving }) {
  return (
    <div className={cn(
      "relative rounded-2xl border bg-card/60 p-5 shadow-sm transition-all duration-200",
      meta.accent,
      isSaved && "ring-1 ring-emerald-500/40 shadow-emerald-500/5",
    )}>
      {/* Saved badge */}
      {isSaved && (
        <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3" /> Saved
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-start gap-3">
        <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted", meta.iconColor)}>
          <KeyRound className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{meta.label}</p>
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", meta.badgeColor)}>
              {meta.badge}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{meta.description}</p>
        </div>
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showKey ? "text" : "password"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) onSave(); }}
            placeholder={isSaved ? "Key saved — paste to update" : meta.placeholder}
            className="h-10 pr-9 bg-background/80 text-sm font-mono"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={toggleShow}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <Button
          size="sm"
          onClick={onSave}
          disabled={!draft.trim() || saving}
          className="h-10 shrink-0 rounded-xl px-4 text-xs font-semibold"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
        </Button>
      </div>

      {/* Get key link */}
      <a
        href={meta.getKeyUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        Get your {meta.label} API key
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

export default function ApiKeySetup() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [settings, setSettings] = useState(null);
  const [drafts,   setDrafts]   = useState({ gemini: "", groq: "" });
  const [showKeys, setShowKeys] = useState({ gemini: false, groq: false });
  const [saving,   setSaving]   = useState({ gemini: false, groq: false });
  const [entering, setEntering] = useState(false);

  useEffect(() => { getAISettings().then(setSettings); }, []);

  // ALL 3 required keys must be present
  const allSaved = settings
    ? REQUIRED.every((p) => settings.keys?.[p])
    : false;

  const savedCount = settings
    ? REQUIRED.filter((p) => settings.keys?.[p]).length
    : 0;

  const handleSave = async (provider) => {
    const key = drafts[provider]?.trim();
    if (!key) return;
    setSaving((s) => ({ ...s, [provider]: true }));
    try {
      const next = await saveAISettings({
        provider,
        keys:   { [provider]: key },
        models: settings?.models || {},
      });
      setSettings(next);
      setDrafts((d) => ({ ...d, [provider]: "" }));
    } finally {
      setSaving((s) => ({ ...s, [provider]: false }));
    }
  };

  const handleEnter = async () => {
    if (!allSaved) return;
    setEntering(true);
    // Activate the first available provider
    const active = REQUIRED.find((p) => settings?.keys?.[p]) || "offline";
    await saveAISettings({ provider: active, keys: {}, models: settings?.models || {} });
    navigate("/", { replace: true });
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "?";

  return (
    <div className="flex min-h-screen flex-col bg-background">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Brain className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-extrabold tracking-tight">NeoCoach</span>
        </div>

        <div className="flex items-center gap-3">
          {/* User avatar */}
          <div className="flex items-center gap-2.5 rounded-full border border-border/60 bg-card px-3 py-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
              {initials}
            </div>
            <span className="hidden text-sm font-medium sm:block">{user?.displayName || user?.email?.split("@")[0]}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl">

          {/* Hero */}
          <div className="mb-8 text-center">
            <div className="mb-3 flex items-center justify-center">
              <div className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl transition-colors",
                allSaved
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-primary/10 text-primary"
              )}>
                {allSaved
                  ? <Unlock className="h-7 w-7" />
                  : <Lock className="h-7 w-7" />}
              </div>
            </div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              {allSaved ? "You're all set!" : "Connect your AI providers"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
              {allSaved
                ? "Both AI keys are configured. Click below to enter your workspace."
                : "NeoCoach needs API keys from both providers to power your Study Coach, flashcards, and smart recommendations."}
            </p>
          </div>

          {/* Progress bar */}
          <div className="mb-6 rounded-2xl border border-border/60 bg-card/50 px-5 py-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">Setup progress</span>
              <span className={cn(
                "font-semibold tabular-nums",
                savedCount === REQUIRED.length ? "text-emerald-400" : "text-muted-foreground"
              )}>
                {savedCount} / {REQUIRED.length}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  savedCount === REQUIRED.length ? "bg-emerald-500" : "bg-primary"
                )}
                style={{ width: `${(savedCount / REQUIRED.length) * 100}%` }}
              />
            </div>
            <div className="mt-2.5 flex gap-2">
              {REQUIRED.map((p) => (
                <div key={p} className="flex items-center gap-1 text-xs">
                  {settings?.keys?.[p]
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    : <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />}
                  <span className={cn(
                    settings?.keys?.[p] ? "text-emerald-400" : "text-muted-foreground"
                  )}>
                    {CARD[p].label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Provider cards */}
          {settings ? (
            <div className="space-y-4">
              {REQUIRED.map((id) => (
                <ProviderCard
                  key={id}
                  id={id}
                  meta={CARD[id]}
                  isSaved={!!settings.keys?.[id]}
                  draft={drafts[id] || ""}
                  setDraft={(v) => setDrafts((d) => ({ ...d, [id]: v }))}
                  showKey={showKeys[id]}
                  toggleShow={() => setShowKeys((s) => ({ ...s, [id]: !s[id] }))}
                  onSave={() => handleSave(id)}
                  saving={saving[id]}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted/60" />
              ))}
            </div>
          )}

          {/* Security note */}
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-blue-500/15 bg-blue-500/5 px-4 py-3">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
            <p className="text-xs leading-5 text-blue-400/90">
              API keys are encrypted using your OS credential store (Electron safeStorage). They never leave your device and are not included in the app bundle. You can update them anytime from <strong>Profile & Settings</strong>.
            </p>
          </div>

          {/* Enter button */}
          <div className="mt-8 flex justify-center">
            {allSaved ? (
              <Button
                onClick={handleEnter}
                disabled={entering}
                size="lg"
                className="h-12 w-full gap-2 rounded-2xl text-sm font-bold shadow-lg shadow-primary/20"
              >
                {entering
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><Sparkles className="h-4 w-4" /> Enter NeoCoach <ArrowRight className="h-4 w-4" /></>
                }
              </Button>
            ) : (
              <div className="w-full space-y-2 text-center">
                <Button
                  disabled
                  size="lg"
                  className="h-12 w-full rounded-2xl text-sm opacity-40 cursor-not-allowed"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Add all 3 keys to continue
                </Button>
                <p className="text-xs text-muted-foreground">
                  {3 - savedCount} provider{3 - savedCount !== 1 ? "s" : ""} remaining
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

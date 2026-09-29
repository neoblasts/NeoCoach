import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusContext } from "@/context/FocusContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/libs/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  Activity,
  AppWindow,
  Ban,
  BookOpen,
  Check,
  CheckCircle2,
  CircleAlert,
  Code2,
  Cpu,
  FileSearch,
  Globe2,
  Heart,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  Wifi,
  X,
  Zap,
  Gamepad2,
  MessageSquare,
  Film,
  Sparkles,
  Dices,
  Clock
} from "lucide-react";
import { DISTRACTING_APPS_DATABASE, DISTRACTING_APP_CATEGORIES } from "@/data/distractingAppsDatabase";

const api = () => window.electronAPI?.focusGuard;

const DEFAULT_CONFIG = {
  allowedApps: [
    { id: "default-zen", name: "Zen Browser", executableName: "zen.exe", enabled: true, category: "study", reason: "Default Web Browser" },
    { id: "default-chrome", name: "Google Chrome", executableName: "chrome.exe", enabled: true, category: "study", reason: "Web browsing for study" },
    { id: "default-edge", name: "Microsoft Edge", executableName: "msedge.exe", enabled: true, category: "study", reason: "Web browsing for study" },
    { id: "default-firefox", name: "Mozilla Firefox", executableName: "firefox.exe", enabled: true, category: "study", reason: "Web browsing for study" },
    { id: "default-brave", name: "Brave Browser", executableName: "brave.exe", enabled: true, category: "study", reason: "Web browsing for study" },
    { id: "default-discord", name: "Discord", executableName: "discord.exe", enabled: true, category: "communication", reason: "Student preference allow rule" },
    { id: "default-mydockfinder", name: "MyDockFinder", executableName: "mydockfinder.exe", enabled: true, category: "utility", reason: "User custom desktop dock" },
    { id: "default-vscode", name: "Visual Studio Code", executableName: "code.exe", enabled: true, category: "developer", reason: "Study IDE" },
    { id: "default-cursor", name: "Cursor Editor", executableName: "cursor.exe", enabled: true, category: "developer", reason: "AI Code Editor" },
    { id: "default-anki", name: "Anki Flashcards", executableName: "anki.exe", enabled: true, category: "study", reason: "Spaced repetition flashcards" },
    { id: "default-obsidian", name: "Obsidian", executableName: "obsidian.exe", enabled: true, category: "study", reason: "Note taking" },
    { id: "default-libreoffice", name: "LibreOffice Writer", executableName: "soffice.exe", enabled: true, category: "study", reason: "Document editing for study" },
  ],
  blockedApps: DISTRACTING_APPS_DATABASE,
  blockSites: true,
  blockApps: true,
  allowlistApps: true,
  blockAllApps: true,
  breakPin: "",
  requireReason: true,
  hourlyReminder: true,
};

function normalizePath(p) {
  if (!p) return "";
  return String(p)
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

function appLabel(item) {
  const raw = String(item?.name || item?.executableName || item?.path || "Application");
  return raw.split(/[\\/]/).pop().replace(/\.exe$/i, "");
}

function appPath(item) {
  return String(item?.path || item?.executablePath || item?.name || "");
}

function getAppKey(item, index = 0) {
  const normP = normalizePath(appPath(item));
  const exe = String(item?.executableName || appLabel(item)).trim().toLowerCase();
  const id = String(item?.id || "").trim().toLowerCase();
  return `app:${normP || id || exe || `index-${index}`}`;
}

function deduplicateApps(list) {
  const seen = new Set();
  const out = [];
  for (const [index, item] of (Array.isArray(list) ? list : []).entries()) {
    const key = getAppKey(item, index);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function StatusDot({ state }) {
  return (
    <span className={cn(
      "inline-flex h-2.5 w-2.5 rounded-full transition-colors duration-300",
      state === "good" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : state === "bad" ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : "bg-amber-500"
    )} />
  );
}

function PolicySectionHeader({ icon: Icon, title, subtitle, badge }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner border border-primary/20">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {badge && <span className="rounded-full border bg-secondary/50 px-3 py-1 text-xs font-semibold">{badge}</span>}
    </div>
  );
}

function cleanDomain(input) {
  if (!input) return "";
  let d = String(input).trim().toLowerCase();
  d = d.replace(/^https?:\/\//i, '');
  d = d.replace(/\/.*$/, '');
  d = d.replace(/^www\./i, '');
  return d;
}

function AppRow({ app, tone, onRemove, onToggleAllow, onToggleBlock }) {
  const key = getAppKey(app);
  return (
    <div key={key} className="group flex items-center gap-3 rounded-xl border border-border/50 bg-background/70 px-3.5 py-2.5 transition-all hover:bg-background hover:border-border">
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-xs",
        tone === "blocked" ? "bg-rose-500/10 text-rose-500" : tone === "protected" ? "bg-blue-500/10 text-blue-500" : "bg-emerald-500/10 text-emerald-500"
      )}>
        {tone === "blocked" ? <Ban className="h-4 w-4" /> : tone === "protected" ? <Lock className="h-4 w-4" /> : <Check className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-bold text-foreground">{appLabel(app)}</p>
          {app?.category && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize">
              {app.category}
            </span>
          )}
        </div>
        <p className="truncate text-[10px] text-muted-foreground font-mono">{app.executableName || appPath(app)}</p>
      </div>
      {onToggleAllow && tone === "blocked" && (
        <Button size="xs" variant="outline" className="h-7 text-[10px] text-emerald-500 hover:text-emerald-400 border-emerald-500/30 rounded-lg" onClick={() => onToggleAllow(app)}>
          Allow
        </Button>
      )}
      {onToggleBlock && tone === "allowed" && (
        <Button size="xs" variant="outline" className="h-7 text-[10px] text-rose-500 hover:text-rose-400 border-rose-500/30 rounded-lg" onClick={() => onToggleBlock(app)}>
          Block
        </Button>
      )}
      {onRemove && (
        <button onClick={() => onRemove(app)} className="rounded-lg p-1.5 text-muted-foreground opacity-70 hover:bg-muted hover:text-rose-500 hover:opacity-100 transition-all" title="Remove rule">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default function FocusGuard() {
  const { toast } = useToast();
  const { emergencyRestore } = useFocusContext();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [status, setStatus] = useState(null);
  const [studyPolicy, setStudyPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stopReason, setStopReason] = useState("");
  const [activeTab, setActiveTab] = useState("apps"); // 'apps' | 'sites' | 'health'
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [appSearchQuery, setAppSearchQuery] = useState("");
  const [appCategoryFilter, setAppCategoryFilter] = useState("ALL");
  const [customSiteInput, setCustomSiteInput] = useState("");
  const [customBlockedSiteInput, setCustomBlockedSiteInput] = useState("");

  const load = useCallback(async () => {
    try {
      const [cfg, nextStatus, policy] = await Promise.all([
        api()?.getConfig?.(),
        api()?.status?.(),
        api()?.getStudyPolicy?.()
      ]);
      if (cfg) {
        const defaultBlocked = DISTRACTING_APPS_DATABASE;
        const allowedExes = new Set((cfg.allowedApps || []).map(x => String(x.executableName || '').toLowerCase()));
        let effectiveBlocked = defaultBlocked.filter(x => !allowedExes.has(String(x.executableName || '').toLowerCase()));
        if (Array.isArray(cfg.blockedApps) && cfg.blockedApps.length >= 50) {
          effectiveBlocked = cfg.blockedApps.filter(x => !allowedExes.has(String(x.executableName || '').toLowerCase()));
        } else if (Array.isArray(cfg.blockedApps) && cfg.blockedApps.length > 0) {
          const existingExes = new Set(cfg.blockedApps.map(x => String(x.executableName || '').toLowerCase()));
          const addedDefaults = defaultBlocked.filter(x => 
            !existingExes.has(String(x.executableName || '').toLowerCase()) && 
            !allowedExes.has(String(x.executableName || '').toLowerCase())
          );
          effectiveBlocked = [...cfg.blockedApps.filter(x => !allowedExes.has(String(x.executableName || '').toLowerCase())), ...addedDefaults];
        }

        setConfig({
          ...DEFAULT_CONFIG,
          ...cfg,
          blockedApps: deduplicateApps(effectiveBlocked),
          allowedApps: deduplicateApps(Array.isArray(cfg.allowedApps) && cfg.allowedApps.length ? cfg.allowedApps : DEFAULT_CONFIG.allowedApps),
          allowedSites: Array.isArray(cfg.allowedSites) ? cfg.allowedSites.map(cleanDomain) : [],
          customBlockedSites: Array.isArray(cfg.customBlockedSites) ? cfg.customBlockedSites.map(cleanDomain) : [],
          allowlistApps: true,
          blockAllApps: true,
        });
      }
      if (nextStatus) setStatus(nextStatus);
      if (policy?.ok) setStudyPolicy(policy);
    } catch (error) {
      toast({ title: "Focus Guard status check error", description: error?.message || "Could not read enforcement state." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 1500);
    return () => window.clearInterval(timer);
  }, [load]);

  const active = status?.active === true;
  const appsExpected = Boolean(active && status?.appEnforcementExpected);
  const appHealthy = !appsExpected || status?.appEnforcementHealthy === true;
  const webExpected = Boolean(active && config.blockSites);
  const webHealthy = !webExpected || status?.websiteEnforcementHealthy === true;

  const save = async (next) => {
    setSaving(true);
    try {
      const merged = {
        ...config,
        ...next,
        blockedApps: deduplicateApps(next.blockedApps || config.blockedApps),
        allowedApps: deduplicateApps(next.allowedApps || config.allowedApps),
        allowedSites: Array.isArray(next.allowedSites || config.allowedSites) ? (next.allowedSites || config.allowedSites).map(cleanDomain) : [],
        customBlockedSites: Array.isArray(next.customBlockedSites || config.customBlockedSites) ? (next.customBlockedSites || config.customBlockedSites).map(cleanDomain) : [],
      };
      const result = await api()?.saveConfig?.(merged);
      if (!result?.ok) throw new Error(result?.error || "Could not save Focus Guard policy.");
      setConfig(merged);
      toast({ title: "Focus Guard policy saved" });
    } catch (error) {
      toast({ title: "Could not save policy", description: error?.message || "Stop Focus Guard before changing enforcement settings." });
    } finally {
      setSaving(false);
    }
  };

  const pickApps = async (mode) => {
    const result = await api()?.pickApps?.({ mode });
    if (!result?.ok || !result.paths?.length) return;
    const target = mode === "blocked" ? config.blockedApps : config.allowedApps;
    const next = [...target];
    for (const selectedPath of result.paths) {
      if (!next.some((item) => normalizePath(appPath(item)) === normalizePath(selectedPath))) {
        next.push({
          id: `manual-${Date.now()}-${next.length}`,
          name: appLabel({ path: selectedPath }),
          executableName: appLabel({ path: selectedPath }) + ".exe",
          path: selectedPath,
          enabled: true,
          category: mode === "blocked" ? "distracting" : "user-allowed",
        });
      }
    }
    await save(mode === "blocked" ? { blockedApps: next } : { allowedApps: next });
  };

  const moveAllowedToBlocked = async (app) => {
    const key = normalizePath(appPath(app));
    const exe = String(app.executableName || '').toLowerCase();
    const newAllowed = (config.allowedApps || []).filter((item) => normalizePath(appPath(item)) !== key && String(item.executableName || '').toLowerCase() !== exe);
    const newBlocked = deduplicateApps([...config.blockedApps, { ...app, category: "distracting", reason: "User blocked rule" }]);
    await save({ blockedApps: newBlocked, allowedApps: newAllowed });
  };

  const removeApp = async (mode, app) => {
    if (mode === "allowed") {
      await moveAllowedToBlocked(app);
      return;
    }
    const key = normalizePath(appPath(app));
    const next = config.blockedApps.filter((item) => normalizePath(appPath(item)) !== key);
    await save({ blockedApps: next });
  };

  const moveBlockedToAllowed = async (app) => {
    const key = normalizePath(appPath(app));
    const exe = String(app.executableName || '').toLowerCase();
    const newBlocked = config.blockedApps.filter((item) => normalizePath(appPath(item)) !== key && String(item.executableName || '').toLowerCase() !== exe);
    const newAllowed = deduplicateApps([...config.allowedApps, { ...app, category: "user-allowed", reason: "User overridden allow rule" }]);
    await save({ blockedApps: newBlocked, allowedApps: newAllowed });
  };

  const stop = async () => {
    const reason = stopReason.trim();
    if (reason.split(/\s+/).length < 5) {
      toast({ title: "Reason too short", description: "You must provide a valid reason of at least 5 words to stop the Focus Timer.", variant: "destructive" });
      return;
    }
    const result = await api()?.deactivate?.({ reason });
    if (result?.ok && result?.active === false) {
      setStopReason("");
      await load();
      toast({ title: "Focus Guard stopped", description: "Application and website enforcement are off." });
    } else if (result) {
      toast({ title: "Guard did not stop cleanly", description: result.error || "Use Emergency Restore." });
    }
  };

  const handleAddSite = async () => {
    const s = cleanDomain(customSiteInput);
    if (!s) return;
    const current = (config.allowedSites || []).map(cleanDomain);
    const currentBlocked = (config.customBlockedSites || []).map(cleanDomain);
    const newAllowed = current.includes(s) ? current : [...current, s];
    const newCustomBlocked = currentBlocked.filter(x => x !== s);
    await save({ allowedSites: newAllowed, customBlockedSites: newCustomBlocked });
    setCustomSiteInput("");
  };

  const handleAddCustomBlockedSite = async () => {
    const s = cleanDomain(customBlockedSiteInput);
    if (!s) return;
    const currentCustomBlocked = (config.customBlockedSites || []).map(cleanDomain);
    const currentAllowed = (config.allowedSites || []).map(cleanDomain);
    const newCustomBlocked = currentCustomBlocked.includes(s) ? currentCustomBlocked : [...currentCustomBlocked, s];
    const newAllowed = currentAllowed.filter(x => x !== s);
    await save({ customBlockedSites: newCustomBlocked, allowedSites: newAllowed });
    setCustomBlockedSiteInput("");
  };

  const allowSpecificSite = async (domain) => {
    const s = cleanDomain(domain);
    if (!s) return;
    const currentAllowed = (config.allowedSites || []).map(cleanDomain);
    const currentCustomBlocked = (config.customBlockedSites || []).map(cleanDomain);
    const newAllowed = currentAllowed.includes(s) ? currentAllowed : [...currentAllowed, s];
    const newCustomBlocked = currentCustomBlocked.filter(x => x !== s);
    await save({ allowedSites: newAllowed, customBlockedSites: newCustomBlocked });
  };

  const handleRemoveSite = async (s) => {
    const target = cleanDomain(s);
    const currentAllowed = (config.allowedSites || []).map(cleanDomain);
    const currentCustomBlocked = (config.customBlockedSites || []).map(cleanDomain);
    const newAllowed = currentAllowed.filter(x => cleanDomain(x) !== target);
    const newCustomBlocked = currentCustomBlocked.includes(target) ? currentCustomBlocked : [...currentCustomBlocked, target];
    await save({ allowedSites: newAllowed, customBlockedSites: newCustomBlocked });
  };

  const categoriesList = useMemo(() => {
    if (!studyPolicy?.categories) return [];
    return Object.entries(studyPolicy.categories).map(([key, value]) => ({
      key,
      name: value.name,
      domains: value.domains
    }));
  }, [studyPolicy]);

  const displayedDomains = useMemo(() => {
    if (!categoriesList.length) return [];
    if (selectedCategory === "ALL") {
      return categoriesList.flatMap(cat => cat.domains.map(d => ({ domain: d, category: cat.name })));
    }
    const cat = categoriesList.find(c => c.key === selectedCategory);
    return (cat?.domains || []).map(d => ({ domain: d, category: cat.name }));
  }, [categoriesList, selectedCategory]);

  const blockedSitesToDisplay = useMemo(() => {
    const defaults = studyPolicy?.blockedDomains ? studyPolicy.blockedDomains.map(cleanDomain) : [];
    const customBlocked = (config.customBlockedSites || []).map(cleanDomain);
    const allBlocked = Array.from(new Set([...customBlocked, ...defaults]));
    const allowed = new Set((config.allowedSites || []).map(cleanDomain));
    return allBlocked.filter(d => !allowed.has(d));
  }, [studyPolicy, config.customBlockedSites, config.allowedSites]);

  const filteredBlockedApps = useMemo(() => {
    const query = appSearchQuery.trim().toLowerCase();
    return (config.blockedApps || []).filter((app) => {
      if (appCategoryFilter !== "ALL" && app.category !== appCategoryFilter) return false;
      if (!query) return true;
      const name = String(app.name || "").toLowerCase();
      const exe = String(app.executableName || "").toLowerCase();
      const reason = String(app.reason || "").toLowerCase();
      return name.includes(query) || exe.includes(query) || reason.includes(query);
    });
  }, [config.blockedApps, appSearchQuery, appCategoryFilter]);

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col gap-3 overflow-hidden p-1 sm:p-2">
      {/* Top Header Card */}
      <header className="flex shrink-0 flex-col gap-3 rounded-2xl border border-border/50 bg-card/60 p-4 shadow-sm backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-inner shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-bold tracking-tight">Focus Guard Engine</h1>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {config.blockedApps.length}+ Apps Guarded
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Hardcoded deterministic blocking for 640+ distracting games, messengers, and streaming apps.</p>
            </div>
          </div>
        </div>

        {/* Global Enforcement Status & Toggles */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3.5 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <StatusDot state={active ? (appHealthy && webHealthy ? "good" : "bad") : "idle"} />
              <span className="text-xs font-bold uppercase tracking-wider">{active ? "Shield Active" : "Shield Ready"}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Cpu className="h-3.5 w-3.5 text-primary" />
              <span>PID {status?.appEnforcerPid || "Idle"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-1.5">
              <span className="text-xs font-medium">Block Apps</span>
              <Switch checked={config.blockApps} disabled={active} onCheckedChange={(v) => save({ blockApps: v })} />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-1.5">
              <span className="text-xs font-medium">Block Sites</span>
              <Switch checked={config.blockSites} disabled={active} onCheckedChange={(v) => save({ blockSites: v })} />
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="flex shrink-0 border-b border-border/50 gap-2 pb-1">
        <button
          onClick={() => setActiveTab("apps")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
            activeTab === "apps" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <AppWindow className="h-4 w-4" />
          <span>Distraction Shield ({config.blockedApps.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("sites")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
            activeTab === "sites" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Globe2 className="h-4 w-4" />
          <span>Study Web Policy ({displayedDomains.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("health")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
            activeTab === "health" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Activity className="h-4 w-4" />
          <span>Enforcement Health</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">

        {/* ── TAB 1: DISTRACTION SHIELD (640+ HARDCODED APPS) ── */}
        {activeTab === "apps" && (
          <div className="space-y-4">
            <section className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4 backdrop-blur-md shadow-sm">
              <PolicySectionHeader
                icon={AppWindow}
                title="Distraction Shield Rules"
                subtitle="Comprehensive hardcoded database of 640+ Windows games, social media clients, streaming players, and gambling apps blocked deterministically without any scan or cloud requirement."
                badge={`${config.blockedApps.length} Pre-configured Rules`}
              />

              {/* Search & Category Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border/50 bg-background/50 backdrop-blur-sm">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search 640+ apps (e.g. steam, valorant, whatsapp, netflix, poker)..."
                    value={appSearchQuery}
                    onChange={(e) => setAppSearchQuery(e.target.value)}
                    className="h-9 pl-9 text-xs rounded-xl bg-background/80"
                  />
                  {appSearchQuery && (
                    <button onClick={() => setAppSearchQuery("")} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap items-center gap-1">
                  {DISTRACTING_APP_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setAppCategoryFilter(cat.id)}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                        appCategoryFilter === cat.id
                          ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                          : "bg-background/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {cat.label} ({cat.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Columns: Blocked Apps Grid & Allowed Apps */}
              <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">

                {/* Left Column: 640+ Blocked Apps */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <Ban className="h-4 w-4" /> Blocked Distractions ({filteredBlockedApps.length})
                    </h3>
                    <Button variant="outline" size="xs" disabled={active} onClick={() => pickApps("blocked")} className="gap-1 text-xs rounded-lg">
                      <Plus className="h-3.5 w-3.5" /> Block Custom .exe
                    </Button>
                  </div>

                  <div className="max-h-[460px] overflow-y-auto space-y-1.5 pr-1 border border-border/40 rounded-xl p-2 bg-background/30">
                    {filteredBlockedApps.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic text-center py-8">No matching applications found.</p>
                    ) : (
                      filteredBlockedApps.map((app) => (
                        <AppRow
                          key={getAppKey(app)}
                          app={app}
                          tone="blocked"
                          onRemove={(a) => removeApp("blocked", a)}
                          onToggleAllow={moveBlockedToAllowed}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Right Column: Allowed Study Tools */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Allowed Study Apps ({config.allowedApps.length})
                    </h3>
                    <Button variant="outline" size="xs" disabled={active} onClick={() => pickApps("allowed")} className="gap-1 text-xs rounded-lg">
                      <Plus className="h-3.5 w-3.5" /> Allow .exe
                    </Button>
                  </div>

                  <div className="max-h-[460px] overflow-y-auto space-y-1.5 pr-1 border border-border/40 rounded-xl p-2 bg-background/30">
                    {config.allowedApps.map((app) => (
                      <AppRow key={getAppKey(app)} app={app} tone="allowed" onToggleBlock={moveAllowedToBlocked} onRemove={(a) => removeApp("allowed", a)} />
                    ))}
                  </div>
                </div>

              </div>
            </section>
          </div>
        )}

        {/* ── TAB 2: STUDY WEB POLICY ── */}
        {activeTab === "sites" && (
          <div className="space-y-4">
            <section className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4 backdrop-blur-md shadow-sm">
              <PolicySectionHeader
                icon={Globe2}
                title="Study Web Policy"
                subtitle="Strict default-deny firewall allowlist for learning domains, study portals, LMS, research wikis, and video lectures."
              />

              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant={selectedCategory === "ALL" ? "default" : "outline"}
                  size="xs"
                  onClick={() => setSelectedCategory("ALL")}
                  className="rounded-lg text-xs"
                >
                  All Categories
                </Button>
                {categoriesList.map(cat => (
                  <Button
                    key={cat.key}
                    variant={selectedCategory === cat.key ? "default" : "outline"}
                    size="xs"
                    onClick={() => setSelectedCategory(cat.key)}
                    className="rounded-lg text-xs"
                  >
                    {cat.name} ({cat.domains.length})
                  </Button>
                ))}
              </div>

              <div className="space-y-2 mt-4">
                <h3 className="text-sm font-bold tracking-tight text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Allowed Websites ({config.allowedSites?.length || 0})
                </h3>
                <div className="flex gap-2">
                  <Input 
                    placeholder="e.g. instagram.com or domain name..." 
                    value={customSiteInput}
                    onChange={e => setCustomSiteInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSite()}
                    className="h-8 text-xs bg-background/80"
                    disabled={active}
                  />
                  <Button size="xs" onClick={handleAddSite} disabled={active || !customSiteInput.trim()}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Allow Website
                  </Button>
                </div>
                {config.allowedSites && config.allowedSites.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-40 overflow-y-auto p-2 border border-emerald-500/20 rounded-xl bg-background/30">
                    {config.allowedSites.map(site => (
                      <div key={site} className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-1.5 text-xs border border-emerald-500/30">
                        <span className="font-mono text-emerald-400 font-semibold truncate" title={site}>{site}</span>
                        <Button size="xs" variant="outline" className="h-6 text-[10px] text-rose-500 hover:text-rose-400 border-rose-500/30 rounded-lg ml-2 shrink-0" onClick={() => !active && handleRemoveSite(site)} disabled={active}>
                          Block
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-80 overflow-y-auto p-2 border border-border/40 rounded-xl bg-background/30 mt-4">
                {displayedDomains.map((item, idx) => (
                  <div key={`dom-${item.domain}-${idx}`} className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-1.5 text-xs border border-border/40">
                    <span className="font-mono text-emerald-400 font-semibold">{item.domain}</span>
                    <span className="text-[9px] text-muted-foreground capitalize truncate max-w-[100px]">{item.category}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold tracking-tight text-rose-400 flex items-center gap-1.5">
                    <Ban className="h-4 w-4" /> Blocked Websites ({blockedSitesToDisplay.length})
                  </h3>
                </div>
                <div className="flex gap-2">
                  <Input 
                    placeholder="e.g. reddit.com or domain name..." 
                    value={customBlockedSiteInput}
                    onChange={e => setCustomBlockedSiteInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddCustomBlockedSite()}
                    className="h-8 text-xs bg-background/80"
                    disabled={active}
                  />
                  <Button size="xs" variant="destructive" onClick={handleAddCustomBlockedSite} disabled={active || !customBlockedSiteInput.trim()}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Block Website
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-2 border border-rose-500/20 rounded-xl bg-background/30 mt-2">
                  {blockedSitesToDisplay.map((domain, idx) => (
                    <div key={`blocked-${domain}-${idx}`} className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-1.5 text-xs border border-rose-500/30">
                      <span className="font-mono text-rose-400 font-semibold truncate" title={domain}>{domain}</span>
                      <Button size="xs" variant="outline" className="h-6 text-[10px] text-emerald-500 hover:text-emerald-400 border-emerald-500/30 rounded-lg ml-2 shrink-0" onClick={() => !active && allowSpecificSite(domain)} disabled={active}>
                        Allow
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground italic text-center">
                All other internet traffic (social media, entertainment, shopping, gaming, distractors) is denied deterministically during active Focus sessions.
              </p>
            </section>
          </div>
        )}

        {/* ── TAB 3: ENFORCEMENT HEALTH & TELEMETRY ── */}
        {activeTab === "health" && (
          <div className="space-y-4">
            <section className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4 backdrop-blur-md shadow-sm">
              <PolicySectionHeader
                icon={Activity}
                title="Enforcement Health & Telemetry"
                subtitle="Real-time heartbeat monitoring, process termination logs, and safety restoration controls."
              />

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/50 bg-background/50 p-4 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Lifecycle State</p>
                  <p className="text-lg font-black">{status?.lifecycle || "INACTIVE"}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">App Enforcer PID: {status?.appEnforcerPid || "Idle"}</p>
                </div>

                <div className="rounded-xl border border-border/50 bg-background/50 p-4 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Process Shield Health</p>
                  <p className={cn("text-lg font-black", appHealthy ? "text-emerald-500" : "text-rose-500")}>
                    {appsExpected ? (appHealthy ? "Active & Healthy" : "Unhealthy") : "Ready"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Matches: {status?.currentlyMatchedBlockedApps || 0} process tree(s)
                  </p>
                </div>

                <div className="rounded-xl border border-border/50 bg-background/50 p-4 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Network Firewall Status</p>
                  <p className={cn("text-lg font-black", webHealthy ? "text-emerald-500" : "text-amber-500")}>
                    {webExpected ? (webHealthy ? "Windows Firewall Active" : "Unhealthy") : "Inactive"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Hardcoded Study Web Policy</p>
                </div>
              </div>

              {/* Termination Logs */}
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-primary" /> Last Terminated Processes
                </h3>
                {(!status?.lastTerminated || status.lastTerminated.length === 0) ? (
                  <p className="text-xs text-muted-foreground italic border border-border/40 rounded-xl p-4 bg-background/30">
                    No processes have been terminated during the current session.
                  </p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-1.5 border border-border/40 rounded-xl p-3 bg-background/30 font-mono text-[11px]">
                    {status.lastTerminated.map((term, idx) => (
                      <div key={`term-log-${term.pid}-${idx}`} className="flex items-center justify-between border-b border-border/40 pb-1">
                        <span className="text-rose-400">TERMINATED {term.name} (PID: {term.pid})</span>
                        <span className="text-muted-foreground">{new Date(term.at).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Daily Routine Setup */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Daily Routine Schedule
                </h3>
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <div className="flex-1 text-sm text-muted-foreground">
                    Set a time for the Focus Timer to automatically launch and start every day.
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Input
                      type="time"
                      value={config.dailyRoutineTime || ""}
                      onChange={(e) => save({ dailyRoutineTime: e.target.value })}
                      className="h-9 w-32 rounded-xl"
                    />
                    <Button variant={config.dailyRoutineTime ? "outline" : "ghost"} size="sm" onClick={() => save({ dailyRoutineTime: "" })} className="h-9 rounded-xl" title="Clear routine">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Teardown & Recovery Controls */}
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Teardown & Recovery Controls
                </h3>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                  <Input
                    value={stopReason}
                    disabled={!active}
                    onChange={(e) => setStopReason(e.target.value)}
                    placeholder="Reason for stopping (min 5 words)"
                    className="h-9 text-xs rounded-xl"
                  />
                  <Button variant="outline" size="sm" disabled={!active} onClick={stop} className="h-9 gap-1.5 rounded-xl">
                    <CircleAlert className="h-4 w-4" /> Stop Focus Guard
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      const result = await emergencyRestore();
                      if (result?.ok) {
                        await load();
                        toast({
                          title: "Emergency Restore Verified",
                          description: "All blocked websites and applications have been restored."
                        });
                      } else {
                        toast({
                          variant: "destructive",
                          title: "Emergency Restore Warning",
                          description: result?.error || "Could not verify full network restoration."
                        });
                      }
                    }}
                    className="h-9 gap-1.5 rounded-xl cursor-pointer"
                  >
                    <ShieldAlert className="h-4 w-4" /> Emergency Restore
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}

      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { localClient } from "@/api/localStorageClient";
import { useEntityList } from "@/hooks/useEntity";
import { useFocusContext } from "@/context/FocusContext";
import {
  calculateStreak,
  formatDuration,
  formatTimer,
  getTodayFocusSeconds,
  getTodaySessionCount,
  getTotalFocusSeconds,
  timeAgo,
} from "@/libs/focusUtils";
import FocusRing from "@/components/focus/FocusRing";
import PresetSelector from "@/components/focus/PresetSelector";
import DurationStepper from "@/components/focus/DurationStepper";
import QuickCheckDialog from "@/components/learn/QuickCheckDialog";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/libs/utils";
import {
  Activity,
  AlertTriangle,
  Bell,
  Brain,
  CheckCircle2,
  ChevronRight,
  CircleStop,
  Clock3,
  Coffee,
  ExternalLink,
  Flag,
  Gauge,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Square,
  Timer,
  Volume2,
  Zap,
} from "lucide-react";

const SESSION_TYPES = [
  { value: "study", label: "Study" },
  { value: "personal", label: "Personal" },
  { value: "work", label: "Work" },
  { value: "other", label: "Other" },
];

const PHASE_META = {
  focus: { label: "Focus", icon: Brain, tone: "text-primary", ring: "text-primary" },
  short_break: { label: "Short break", icon: Coffee, tone: "text-emerald-500", ring: "text-emerald-500" },
  long_break: { label: "Long break", icon: Flag, tone: "text-blue-500", ring: "text-blue-500" },
};

function SelectInput({ value, onChange, options, placeholder, disabled }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full rounded-lg border border-input bg-secondary/35 px-2 text-xs outline-none transition-colors focus:border-primary/40 disabled:opacity-50"
    >
      <option value="">{placeholder || "Select..."}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function CompactStatChip({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border bg-card/80 px-2.5 py-1 text-xs">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-[10px] text-muted-foreground uppercase">{label}:</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

function GuardIndicator({ status }) {
  const active = Boolean(status?.active);
  const starting = status?.lifecycle === "STARTING";
  const stopping = status?.lifecycle === "STOPPING" || status?.cleanupInProgress;
  const appExpected = Boolean(status?.appEnforcementExpected);
  const appHealthy = !appExpected || status?.appEnforcementHealthy === true;
  const webExpected = Boolean(status?.websiteBlockingEnabled);
  const webHealthy = !webExpected || status?.websiteEnforcementHealthy === true;
  const fullyHealthy = active && appHealthy && webHealthy;
  const degraded = active && (!appHealthy || !webHealthy);

  let stateLabel = "INACTIVE";
  if (stopping) stateLabel = "STOPPING";
  else if (starting) stateLabel = "STARTING";
  else if (fullyHealthy) stateLabel = "ACTIVE";
  else if (degraded) stateLabel = "DEGRADED";

  return (
    <div className={cn(
      "rounded-xl border p-2.5 transition-colors",
      fullyHealthy ? "border-emerald-500/20 bg-emerald-500/5" : degraded ? "border-rose-500/30 bg-rose-500/10" : stopping || starting ? "border-amber-500/30 bg-amber-500/10" : "border-border bg-card/70"
    )}>
      <div className="flex items-center gap-2">
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg shrink-0",
          fullyHealthy ? "bg-emerald-500/10 text-emerald-500" : degraded ? "bg-rose-500/10 text-rose-500" : "bg-muted text-muted-foreground"
        )}>
          {fullyHealthy ? <ShieldCheck className="h-3.5 w-3.5" /> : degraded ? <AlertTriangle className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold leading-none">Focus Guard</p>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
            {stateLabel === "ACTIVE" ? "Live enforcement verified" : stateLabel === "DEGRADED" ? "Degraded State" : stateLabel === "STARTING" ? "Initializing…" : "Inactive / Armed"}
          </p>
        </div>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0",
          fullyHealthy ? "bg-emerald-500/15 text-emerald-500" : degraded ? "bg-rose-500/15 text-rose-500" : starting || stopping ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"
        )}>
          {stateLabel}
        </span>
      </div>

      {active && (
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] text-muted-foreground font-mono">
          <div className={cn("rounded-md px-1.5 py-1 border text-center", appHealthy ? "bg-background/70 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400")}>
            Apps: {appExpected ? (appHealthy ? "Healthy" : "ERROR") : "Off"}
          </div>
          <div className={cn("rounded-md px-1.5 py-1 border text-center", webHealthy ? "bg-background/70 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400")}>
            Web: {webExpected ? (webHealthy ? "Healthy" : "ERROR") : "Off"}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Focus() {
  const [searchParams] = useSearchParams();
  const {
    engine,
    settings,
    updateSettings,
    startSession,
    stopSession,
    startError,
    lastSession,
    reloadSignal,
    guardStatus,
  } = useFocusContext();

  const { data: subjects } = useEntityList(() => localClient.entities.Subject.list());
  const { data: topics } = useEntityList(() => localClient.entities.Topic.list());
  const { data: assignments } = useEntityList(() => localClient.entities.Assignment.list());
  const { data: tasks } = useEntityList(() => localClient.entities.Task.list());
  const { data: sessions, loading: sessionsLoading, reload: reloadSessions } = useEntityList(
    () => localClient.entities.FocusSession.list("-started_at", 200)
  );

  useEffect(() => { reloadSessions(); }, [reloadSignal]);

  const subjectMap = useMemo(() => Object.fromEntries(subjects.map((item) => [item.id, item])), [subjects]);
  const topicMap = useMemo(() => Object.fromEntries(topics.map((item) => [item.id, item])), [topics]);

  const [quickCheckOpen, setQuickCheckOpen] = useState(false);
  const [quickCheckOffer, setQuickCheckOffer] = useState(false);
  const [starting, setStarting] = useState(false);
  const [label, setLabel] = useState(searchParams.get("label") || "");
  const [preset, setPreset] = useState(searchParams.get("preset") || "pomodoro");
  const [subjectId, setSubjectId] = useState(searchParams.get("subjectId") || "");
  const [topicId, setTopicId] = useState(searchParams.get("topicId") || searchParams.get("topic_id") || "");
  const [assignmentId, setAssignmentId] = useState(searchParams.get("assignmentId") || "");
  const [taskId, setTaskId] = useState("");
  const [sessionType, setSessionType] = useState("study");
  const previousActiveRef = useRef(false);
  const { toast } = useToast();

  const [routineEnabled, setRoutineEnabled] = useState(false);
  const [routineStartTime, setRoutineStartTime] = useState("18:00");
  const [routineEndTime, setRoutineEndTime] = useState("21:00");
  const [routineModalOpen, setRoutineModalOpen] = useState(false);

  useEffect(() => {
    async function loadRoutine() {
      try {
        const cfg = await window.electronAPI?.focusGuard?.getConfig?.();
        if (cfg) {
          setRoutineEnabled(cfg.dailyRoutineEnabled !== false && Boolean(cfg.dailyRoutineTime));
          setRoutineStartTime(cfg.dailyRoutineTime || "18:00");
          setRoutineEndTime(cfg.dailyRoutineEndTime || "21:00");
        }
      } catch (e) {
        console.warn("Routine load error:", e);
      }
    }
    loadRoutine();

    const unsubscribe = window.electronAPI?.focusGuard?.onRoutineTriggered?.(() => {
      setRoutineModalOpen(true);
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  const saveRoutine = async (overrides = {}) => {
    const isEnabled = overrides.enabled !== undefined ? overrides.enabled : routineEnabled;
    const startTime = overrides.startTime || routineStartTime;
    const endTime = overrides.endTime || routineEndTime;
    try {
      await window.electronAPI?.focusGuard?.saveConfig?.({
        dailyRoutineEnabled: isEnabled,
        dailyRoutineTime: startTime,
        dailyRoutineEndTime: endTime,
        dailyRoutineLabel: label || "Scheduled Study Session"
      });
      toast({ title: "Study Schedule Saved", description: isEnabled ? `Daily routine active for ${startTime} - ${endTime}` : "Daily study routine disabled." });
    } catch (e) {
      console.warn("Routine save failed:", e);
    }
  };

  useEffect(() => {
    if (previousActiveRef.current && !engine.active && lastSession?.topicId) {
      setQuickCheckOffer(true);
    }
    previousActiveRef.current = engine.active;
  }, [engine.active, lastSession]);

  const filteredTopics = subjectId ? topics.filter((item) => item.subject_id === subjectId) : [];
  const filteredAssignments = subjectId ? assignments.filter((item) => item.subject_id === subjectId) : assignments;
  const phaseMeta = PHASE_META[engine.phase] || PHASE_META.focus;
  const PhaseIcon = phaseMeta.icon;
  const progress = engine.total > 0 ? (engine.total - engine.remaining) / engine.total : 0;

  const todaySeconds = getTodayFocusSeconds(sessions);
  const todayCount = getTodaySessionCount(sessions);
  const streak = calculateStreak(sessions);
  const totalSeconds = getTotalFocusSeconds(sessions);
  const recentSessions = sessions.slice(0, 10);

  const showFocusDuration = preset !== "short_break" && preset !== "long_break";
  const showShortBreak = ["pomodoro", "custom_pomodoro", "short_break"].includes(preset);
  const showLongBreak = ["pomodoro", "custom_pomodoro", "long_break"].includes(preset);
  const showRounds = ["pomodoro", "custom_pomodoro"].includes(preset);

  const updateSetting = (key, value) => updateSettings({ ...settings, [key]: value });

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    setQuickCheckOffer(false);
    try {
      await startSession({ preset, label, subjectId, topicId, assignmentId, taskId, sessionType });
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col gap-3 overflow-hidden">
      {/* Header section — compact header bar fitting stats inline */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b pb-2.5">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">Focus Mode</h1>
          {engine.active && (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              LIVE
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <CompactStatChip icon={Clock3} value={formatDuration(todaySeconds)} label="Today" />
          <CompactStatChip icon={CheckCircle2} value={todayCount} label="Sessions" />
          <CompactStatChip icon={Zap} value={streak} label="Streak" />
          <CompactStatChip icon={Gauge} value={formatDuration(totalSeconds)} label="Total" />
        </div>
      </header>

      {/* Main 2-column grid — strictly fills remaining height without causing outer page scroll */}
      <div className="grid flex-1 min-h-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left Column: Timer Active Card OR Setup Form */}
        <section className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border bg-card/60">
          {engine.active ? (
            <div className="flex flex-1 min-h-0 flex-col items-center justify-center p-4 text-center overflow-hidden">
              {/* Phase Badge */}
              <div className="mb-3 flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
                <PhaseIcon className={cn("h-3.5 w-3.5", phaseMeta.tone)} />
                {phaseMeta.label} · Round {engine.round}
              </div>

              {/* Compact Focus Ring — max 200px width so it fits cleanly on one page */}
              <FocusRing progress={progress} colorClass={phaseMeta.ring} className="max-w-[190px] sm:max-w-[210px]">
                <p className="text-4xl font-black tabular-nums tracking-tight sm:text-5xl">{formatTimer(engine.remaining)}</p>
                <p className="mt-1 max-w-[180px] truncate text-center text-[11px] text-muted-foreground font-medium">
                  {engine.sessionMeta?.label || "Focus session"}
                </p>
              </FocusRing>

              {/* Control Buttons Row */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {engine.running ? (
                  <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs px-3" onClick={engine.pause}>
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </Button>
                ) : (
                  <Button size="sm" className="h-8 gap-1.5 text-xs px-3" onClick={engine.resume}>
                    <Play className="h-3.5 w-3.5" /> Resume
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs px-3" onClick={engine.restart}>
                  <RotateCcw className="h-3.5 w-3.5" /> Restart
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs px-3" onClick={engine.skip}>
                  <SkipForward className="h-3.5 w-3.5" /> Skip
                </Button>
                <Button size="sm" variant="destructive" className="h-8 gap-1.5 text-xs px-3" onClick={() => stopSession()}>
                  <Square className="h-3.5 w-3.5" /> Stop
                </Button>
              </div>

              {/* Compact Enforcement Badges */}
              <div className="mt-4 grid w-full max-w-md grid-cols-2 gap-2 text-left">
                <div className="rounded-xl border bg-card/70 p-2.5">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-primary shrink-0" />
                    <p className="text-xs font-semibold">App Enforcement</p>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
                    {guardStatus?.appEnforcementExpected ? `${guardStatus.currentlyMatchedBlockedApps || 0} blocked match(es)` : "No blocked apps"}
                  </p>
                </div>
                <div className="rounded-xl border bg-card/70 p-2.5">
                  <div className="flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="text-xs font-semibold">Network Filter</p>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground truncate">Universal proxy active</p>
                </div>
              </div>

              {startError && (
                <div className="mt-3 flex max-w-md items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-2.5 py-1.5 text-[11px] text-rose-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{startError}</span>
                </div>
              )}
            </div>
          ) : (
            /* Setup Form View — compact single page layout */
            <div className="flex flex-1 min-h-0 flex-col overflow-y-auto p-4 space-y-3">
              {startError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{startError}</span>
                </div>
              )}

              {quickCheckOffer && lastSession?.topicId && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs font-semibold">Quick Check ready</p>
                      <p className="text-[10px] text-muted-foreground">{topicMap[lastSession.topicId]?.name || "Your last topic"}</p>
                    </div>
                  </div>
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setQuickCheckOpen(true); setQuickCheckOffer(false); }}>
                    Open <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              )}

              <PresetSelector value={preset} onChange={setPreset} />

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {showFocusDuration && <DurationStepper label="Focus" value={settings.focusDuration} onChange={(value) => updateSetting("focusDuration", value)} min={1} max={180} />}
                {showShortBreak && <DurationStepper label="Short break" value={settings.shortBreak} onChange={(value) => updateSetting("shortBreak", value)} min={1} max={60} />}
                {showLongBreak && <DurationStepper label="Long break" value={settings.longBreak} onChange={(value) => updateSetting("longBreak", value)} min={1} max={60} />}
                {showRounds && <DurationStepper label="Rounds" value={settings.sessionsBeforeLongBreak} onChange={(value) => updateSetting("sessionsBeforeLongBreak", value)} min={2} max={10} unit="" />}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border bg-card/60 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium"><Volume2 className="h-3.5 w-3.5 text-muted-foreground" /> Sound</span>
                    <Switch checked={settings.soundEnabled} onCheckedChange={(value) => updateSetting("soundEnabled", value)} />
                  </div>
                </div>
                <div className="rounded-xl border bg-card/60 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium"><Bell className="h-3.5 w-3.5 text-muted-foreground" /> Reminders</span>
                    <Switch checked={settings.notificationsEnabled} onCheckedChange={(value) => updateSetting("notificationsEnabled", value)} />
                  </div>
                </div>
                <div className="rounded-xl border bg-card/60 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Auto Breaks</span>
                    <Switch checked={settings.autoStartBreaks} onCheckedChange={(value) => updateSetting("autoStartBreaks", value)} />
                  </div>
                </div>
              </div>

              {settings.notificationsEnabled && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium flex items-center gap-1.5"><Bell className="h-3.5 w-3.5 text-primary" /> Reminder Interval</span>
                  <DurationStepper label="" value={settings.reminderIntervalMinutes || 10} onChange={(val) => updateSetting("reminderIntervalMinutes", val)} min={1} max={60} unit="min" />
                </div>
              )}

              <div className="rounded-xl border bg-card/60 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={label} onChange={(event) => setLabel(event.target.value)} className="h-8 text-xs" placeholder="Session label (optional)" />
                  <SelectInput value={sessionType} onChange={setSessionType} options={SESSION_TYPES} placeholder="Session type" />
                  <SelectInput value={subjectId} onChange={(value) => { setSubjectId(value); setTopicId(""); setAssignmentId(""); }} options={subjects.map((s) => ({ value: s.id, label: s.name }))} placeholder="Subject" />
                  <SelectInput value={topicId} onChange={setTopicId} options={filteredTopics.map((t) => ({ value: t.id, label: t.name }))} placeholder="Topic" disabled={!subjectId} />
                  <SelectInput value={assignmentId} onChange={setAssignmentId} options={filteredAssignments.map((a) => ({ value: a.id, label: a.title }))} placeholder="Assignment" />
                  <SelectInput value={taskId} onChange={setTaskId} options={tasks.map((t) => ({ value: t.id, label: t.title }))} placeholder="Task" />
                </div>
              </div>

              <Button className="h-10 w-full gap-2 rounded-xl text-xs font-bold" size="lg" disabled={starting} onClick={handleStart}>
                {starting ? <Activity className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
                {starting ? "Verifying Focus Guard…" : "Start Focus Session"}
              </Button>

              {/* Daily Study Routine Auto-Scheduler Card */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Clock3 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Daily Fixed Study Routine</p>
                      <p className="text-[10px] text-muted-foreground">App runs in background & prompts you at your fixed study hours</p>
                    </div>
                  </div>
                  <Switch 
                    checked={routineEnabled} 
                    onCheckedChange={(v) => {
                      setRoutineEnabled(v);
                      saveRoutine({ enabled: v });
                    }} 
                  />
                </div>

                {routineEnabled && (
                  <div className="space-y-2 pt-2 border-t border-primary/10 animate-in fade-in">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">Start Time</label>
                        <Input 
                          type="time" 
                          value={routineStartTime} 
                          onChange={(e) => setRoutineStartTime(e.target.value)} 
                          className="h-8 text-xs bg-background/80 font-mono" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">End Time</label>
                        <Input 
                          type="time" 
                          value={routineEndTime} 
                          onChange={(e) => setRoutineEndTime(e.target.value)} 
                          className="h-8 text-xs bg-background/80 font-mono" 
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[10px] font-semibold text-emerald-400 font-mono">
                        {routineStartTime ? `Active Daily: ${routineStartTime} - ${routineEndTime || 'End'}` : "Set study hours"}
                      </span>
                      <Button size="xs" variant="outline" className="h-7 text-[10px] rounded-lg gap-1 border-primary/30 text-primary" onClick={() => saveRoutine()}>
                        <CheckCircle2 className="h-3 w-3" /> Save Schedule
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right Aside Column: Status + History List */}
        <aside className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden">
          <GuardIndicator status={guardStatus} />

          <div className="rounded-2xl border bg-card/60 p-3 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold">Session Settings</p>
                <p className="text-[10px] text-muted-foreground">Local preferences</p>
              </div>
              <Timer className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-secondary/35 px-2.5 py-1 text-[11px]"><span className="text-muted-foreground">Preset</span><span className="font-semibold capitalize">{preset.replaceAll("_", " ")}</span></div>
              <div className="flex items-center justify-between rounded-lg bg-secondary/35 px-2.5 py-1 text-[11px]"><span className="text-muted-foreground">Focus duration</span><span className="font-semibold">{settings.focusDuration} min</span></div>
              <div className="flex items-center justify-between rounded-lg bg-secondary/35 px-2.5 py-1 text-[11px]"><span className="text-muted-foreground">Blocked apps</span><span className="font-semibold">{guardStatus?.blockedApps?.length ?? "—"}</span></div>
            </div>
          </div>

          <div className="lifeos-surface flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border">
            <div className="shrink-0 border-b px-3 py-2">
              <p className="text-xs font-bold">Recent Sessions</p>
              <p className="text-[10px] text-muted-foreground">Latest focus history</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              {sessionsLoading ? (
                <div className="space-y-1.5">{[1, 2, 3].map((item) => <div key={item} className="h-10 animate-pulse rounded-lg bg-muted" />)}</div>
              ) : recentSessions.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground p-4">
                  <CircleStop className="h-6 w-6 opacity-30" />
                  <p className="mt-1 text-[11px]">No sessions yet</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentSessions.map((session) => {
                    const meta = PHASE_META[session.mode] || PHASE_META.focus;
                    const Icon = meta.icon;
                    return (
                      <div key={session.id} className="rounded-lg border bg-background/60 p-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10", meta.tone)}><Icon className="h-3.5 w-3.5" /></div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold leading-none">{session.label || meta.label}</p>
                            <p className="truncate text-[10px] text-muted-foreground mt-0.5">
                              {formatDuration(session.actual_duration_seconds || session.planned_duration_seconds)}
                              {session.subject_id && subjectMap[session.subject_id] ? ` · ${subjectMap[session.subject_id].name}` : ""}
                              {" · "}{timeAgo(session.started_at)}
                            </p>
                          </div>
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <QuickCheckDialog
        open={quickCheckOpen}
        onOpenChange={setQuickCheckOpen}
        topicId={lastSession?.topicId}
        subjectId={lastSession?.subjectId}
        topicName={topicMap[lastSession?.topicId]?.name || ""}
      />

      {/* Study Routine Triggered Modal Dialog */}
      {routineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-primary/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">It's Study Time Now! 📚</h2>
                <p className="text-xs text-muted-foreground">Your scheduled focus routine ({routineStartTime || "Routine"}{routineEndTime ? ` - ${routineEndTime}` : ""}) has arrived.</p>
              </div>
            </div>
            <div className="rounded-xl bg-primary/5 p-3 text-xs text-muted-foreground border border-primary/10 font-medium">
              Do you want to turn on Focus Mode to study? Focus Guard will enforce your study apps and block distractions.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setRoutineModalOpen(false)}>
                Dismiss / Later
              </Button>
              <Button size="sm" className="rounded-xl text-xs font-bold gap-1.5" onClick={() => { setRoutineModalOpen(false); handleStart(); }}>
                <Play className="h-3.5 w-3.5" /> Turn On Focus Mode
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

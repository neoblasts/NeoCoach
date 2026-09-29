import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { useFocusContext } from "@/context/FocusContext";
import { formatTimer } from "@/libs/focusUtils";
import { cn } from "@/libs/utils";
import { Pause, Play, Square, Brain, Coffee, MoonStar, ShieldAlert, RotateCcw } from "lucide-react";

const PHASE_COLORS = {
  focus:       "border-primary/30 bg-primary/15 text-primary",
  short_break: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  long_break:  "border-blue-500/30 bg-blue-500/15 text-blue-300",
};

const PHASE_ICON = { focus: Brain, short_break: Coffee, long_break: MoonStar };

function EmergencyGuardBar() {
  const { guardActive, emergencyRestore } = useFocusContext();
  const [working, setWorking] = useState(false);
  if (!guardActive) return null;

  const handleEmergency = async () => {
    if (working) return;
    setWorking(true);
    try {
      await emergencyRestore();
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mx-4 mt-2 flex shrink-0 items-center justify-between gap-3 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs lg:mx-6">
      <div className="flex min-w-0 items-center gap-2">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-400" />
        <div className="min-w-0 flex items-center gap-2">
          <p className="font-semibold text-rose-200">Focus Guard Active</p>
          <span className="hidden text-[11px] text-rose-200/70 sm:inline">• Emergency Restore removes network/app restrictions</span>
        </div>
      </div>
      <button
        onClick={handleEmergency}
        disabled={working}
        className="flex shrink-0 items-center gap-1 rounded-md border border-rose-400/30 bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-60"
      >
        <RotateCcw className="h-3 w-3" />
        {working ? "Restoring…" : "Emergency Restore"}
      </button>
    </div>
  );
}

function MiniTimerBar() {
  const { engine, stopSession } = useFocusContext();
  const navigate = useNavigate();
  const location = useLocation();

  // Don't render MiniTimerBar if user is already on the Focus page
  if (!engine.active || location.pathname === "/focus") return null;

  const PhaseIcon = PHASE_ICON[engine.phase] || Brain;
  const colorClass = PHASE_COLORS[engine.phase] || PHASE_COLORS.focus;
  const label = engine.phase === "focus" ? "Focus" : engine.phase === "short_break" ? "Short Break" : "Long Break";

  return (
    <div className={cn(
      "mx-4 mt-2 flex shrink-0 items-center justify-between gap-3 rounded-lg border px-3 py-1 text-xs lg:mx-6",
      colorClass
    )}>
      {/* Left: icon + phase + label */}
      <button
        onClick={() => navigate("/focus")}
        className="flex items-center gap-2 font-medium hover:opacity-80 transition-opacity"
      >
        <PhaseIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{label}</span>
        {engine.sessionMeta?.label && (
          <span className="hidden opacity-75 sm:inline">· {engine.sessionMeta.label}</span>
        )}
      </button>

      {/* Centre: timer */}
      <button
        onClick={() => navigate("/focus")}
        className="font-display text-sm font-bold tabular-nums tracking-tight hover:opacity-80 transition-opacity"
      >
        {formatTimer(engine.remaining)}
      </button>

      {/* Right: controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={engine.running ? engine.pause : engine.resume}
          className="rounded-lg p-1 hover:bg-white/20 transition-colors"
          title={engine.running ? "Pause" : "Resume"}
        >
          {engine.running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={stopSession}
          className="rounded-lg p-1 hover:bg-white/20 transition-colors"
          title="Stop session"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="lifeos-app-bg h-screen overflow-hidden bg-background text-foreground flex flex-col">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex h-full flex-1 flex-col overflow-hidden lg:pl-64">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <EmergencyGuardBar />
        <MiniTimerBar />
        <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          <div className="mx-auto flex-1 min-h-0 w-full max-w-[1400px] px-4 py-3 lg:px-6 lg:py-4 flex flex-col">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

import FocusRing from "./FocusRing";
import { Button } from "@/components/ui/button";
import { formatTimer } from "@/libs/focusUtils";
import { cn } from "@/libs/utils";
import { Pause, Play, Square, SkipForward, RotateCcw } from "lucide-react";

const PHASE_CONFIG = {
  focus: { label: "Focus", colorClass: "text-primary", bg: "from-primary/5" },
  short_break: { label: "Short Break", colorClass: "text-emerald-500", bg: "from-emerald-500/5" },
  long_break: { label: "Long Break", colorClass: "text-blue-500", bg: "from-blue-500/5" },
};

export default function FocusActive({ engine, sessionInfo }) {
  const { phase, running, remaining, total, round, cycleCount, pause, resume, stop, skip, restart } = engine;
  const config = PHASE_CONFIG[phase] || PHASE_CONFIG.focus;
  const progress = total > 0 ? (total - remaining) / total : 0;

  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border bg-gradient-to-b to-transparent p-8 shadow-sm transition-colors duration-500 sm:p-12", config.bg)}>
      <div className="mb-6 text-center">
        <p className={cn("text-sm font-semibold uppercase tracking-wider", config.colorClass)}>{config.label}</p>
        {sessionInfo.hasCycle && (
          <p className="mt-1 text-xs text-muted-foreground">
            Round {round} · Session {(cycleCount % sessionInfo.sessionsBeforeLongBreak) + (phase === "focus" ? 1 : 0)} of {sessionInfo.sessionsBeforeLongBreak}
          </p>
        )}
      </div>

      <FocusRing progress={progress} colorClass={config.colorClass}>
        <span className="font-display text-5xl font-bold tabular-nums sm:text-6xl">{formatTimer(remaining)}</span>
        <span className="mt-2 text-xs text-muted-foreground">{running ? "in progress" : "paused"}</span>
      </FocusRing>

      <div className="mt-6 min-h-[3rem] text-center">
        {sessionInfo.label && <p className="font-medium">{sessionInfo.label}</p>}
        {sessionInfo.subjectName && <p className="text-sm text-muted-foreground">{sessionInfo.subjectName}</p>}
      </div>

      <div className="mt-8 flex items-center gap-3">
        <Button variant="outline" size="icon" className="rounded-full" onClick={stop} aria-label="Stop">
          <Square className="h-5 w-5" />
        </Button>
        {running ? (
          <Button size="lg" className="gap-2 rounded-full px-8" onClick={pause}>
            <Pause className="h-5 w-5" /> Pause
          </Button>
        ) : (
          <Button size="lg" className="gap-2 rounded-full px-8" onClick={resume}>
            <Play className="h-5 w-5" /> Resume
          </Button>
        )}
        <Button variant="outline" size="icon" className="rounded-full" onClick={skip} aria-label="Skip">
          <SkipForward className="h-5 w-5" />
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="mt-3 gap-1.5 text-muted-foreground" onClick={restart}>
        <RotateCcw className="h-3.5 w-3.5" /> Restart
      </Button>
    </div>
  );
}
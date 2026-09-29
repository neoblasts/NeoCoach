import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { generateDailyPlan } from "@/libs/studyPlanner";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  Play,
  Layers,
  HelpCircle,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import { cn } from "@/libs/utils";

export default function DailyPlannerStrip() {
  const [minutes, setMinutes] = useState(90);
  const [completedBlocks, setCompletedBlocks] = useState({});

  const plan = useMemo(() => {
    return generateDailyPlan(minutes);
  }, [minutes]);

  const toggleComplete = (id) => {
    setCompletedBlocks((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getIcon = (type) => {
    if (type === "flashcards") return Layers;
    if (type === "quiz") return HelpCircle;
    if (type === "weak_topic" || type === "mistake_review") return AlertTriangle;
    return BookOpen;
  };

  return (
    <div className="lifeos-surface rounded-xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.14)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Calendar className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
              Daily Study Planner
            </h3>
            <p className="text-[11px] text-muted-foreground">Adaptive time-blocked schedule</p>
          </div>
        </div>

        {/* Time Budget Selector */}
        <div className="flex items-center gap-1 text-xs">
          {[60, 90, 120].map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-bold transition",
                minutes === m
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>

      {/* Blocks List */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {plan.blocks.map((block) => {
          const isDone = Boolean(completedBlocks[block.id]);
          const Icon = getIcon(block.type);

          return (
            <div
              key={block.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border p-2.5 transition",
                isDone
                  ? "border-emerald-500/20 bg-emerald-500/5 opacity-70"
                  : "border-border/40 bg-card/60 hover:border-primary/30 hover:bg-accent/20"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() => toggleComplete(block.id)}
                  className="shrink-0 text-muted-foreground hover:text-primary transition"
                  title={isDone ? "Mark incomplete" : "Mark completed"}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {block.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{block.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                  <Clock className="h-3 w-3" />
                  {block.durationMinutes}m
                </span>
                <Link to={block.actionUrl}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 rounded-md hover:bg-primary/20 hover:text-primary"
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

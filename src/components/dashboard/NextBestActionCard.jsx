import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/libs/utils";
import {
  Zap,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Layers,
  HelpCircle,
  BookOpen,
  Timer,
  AlertTriangle,
  Play,
} from "lucide-react";

export default function NextBestActionCard({ recommendation }) {
  const navigate = useNavigate();
  const [showWhy, setShowWhy] = useState(false);

  if (!recommendation) return null;

  const { title, subtitle, durationMinutes, urgency, badge, reasons = [], action } = recommendation;

  const handleStart = () => {
    if (!action) return;
    if (action.type === "navigate" && action.url) {
      navigate(action.url);
    } else if (action.type === "focus") {
      const params = new URLSearchParams();
      if (action.subjectId) params.set("subjectId", action.subjectId);
      if (action.topicId) params.set("topic_id", action.topicId);
      params.set("label", title);
      params.set("preset", "custom");
      navigate(`/focus?${params.toString()}`);
    }
  };

  const getIcon = () => {
    if (badge?.includes("Flashcard") || badge?.includes("Spaced")) return Layers;
    if (badge?.includes("Quiz") || badge?.includes("Testing")) return HelpCircle;
    if (badge?.includes("Weak") || badge?.includes("Reinforce")) return AlertTriangle;
    return BookOpen;
  };
  const Icon = getIcon();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/35 bg-gradient-to-r from-card via-card to-primary/10 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] transition-all">
      {/* Top Badge Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/20 px-2.5 text-[11px] font-extrabold uppercase tracking-wider text-primary shadow-sm">
            <Zap className="h-3.5 w-3.5 fill-primary/30 text-primary" /> NEXT BEST ACTION
          </span>
          {badge && (
            <span
              className={cn(
                "rounded-lg border px-2.5 py-0.5 text-[11px] font-bold tracking-wide",
                urgency === "high"
                  ? "border-rose-500/40 bg-rose-500/15 text-rose-400"
                  : "border-teal-500/40 bg-teal-500/15 text-teal-300"
              )}
            >
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-lg border border-border/40">
          <Timer className="h-3.5 w-3.5 text-primary" />
          <span>{durationMinutes} min</span>
        </div>
      </div>

      {/* Main Body */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-extrabold text-foreground sm:text-lg tracking-tight leading-tight">
              {title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={handleStart}
          className="h-11 shrink-0 gap-2 rounded-xl bg-primary px-6 text-xs font-bold text-primary-foreground shadow-[0_6px_20px_rgba(32,199,201,0.30)] hover:bg-primary/90 hover:shadow-[0_8px_24px_rgba(32,199,201,0.40)] active:scale-[0.98] transition-all"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>{action?.label || "Start Review"}</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Collapsible Local Rationale */}
      <div className="mt-4 border-t border-border/40 pt-2.5">
        <button
          onClick={() => setShowWhy(!showWhy)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline transition"
        >
          {showWhy ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <span>Why was this chosen? (Local Decision Engine)</span>
        </button>

        {showWhy && (
          <div className="mt-2.5 space-y-2 rounded-xl border border-border/40 bg-muted/20 p-3.5 text-xs text-muted-foreground backdrop-blur-sm">
            {reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span className="leading-relaxed">{r}</span>
              </div>
            ))}
            <p className="pt-1 text-[10px] text-muted-foreground/60 italic border-t border-border/30 mt-2">
              Determined locally based on spaced repetition intervals, topic decay rates, and syllabus deadlines.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

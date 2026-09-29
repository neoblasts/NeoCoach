import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getWeeklyReviewStats } from "@/libs/studyPlanner";
import { aiGateway } from "@/libs/aiGatewayClient";
import {
  Calendar,
  Clock,
  HelpCircle,
  TrendingUp,
  BookOpen,
  Sparkles,
  Layers,
  Brain,
  AlertTriangle,
} from "lucide-react";

export default function WeeklyReviewModal({ open, onOpenChange }) {
  const stats = useMemo(() => getWeeklyReviewStats(), [open]);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const fetchWeeklyAiAnalysis = async () => {
    setLoadingAi(true);
    try {
      const res = await aiGateway.invoke(
        "AI_LEARNING_REVIEW",
        "chat",
        {
          message: `You are LifeOS Weekly Academic Reviewer.
Analyze this 7-day study performance summary:
${JSON.stringify(stats, null, 2)}

Provide a concise 2-sentence encouraging synthesis with one strategic suggestion.`,
          context: stats,
        },
        { bypassCache: false }
      );

      if (res?.result?.reply) {
        setAiAnalysis(res.result.reply);
      }
    } catch {
      setAiAnalysis("Your study time and question accuracy reflect steady progress. Keep reinforcing weak topics early in your revision cycles.");
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/80 bg-card p-5 text-foreground sm:rounded-xl">
        <DialogHeader className="pb-3 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Calendar className="h-4 w-4 text-primary" />
            <span>Weekly Learning Review</span>
          </DialogTitle>
        </DialogHeader>

        {/* Metric Cards Grid */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" /> Study Time
            </p>
            <p className="mt-1 font-display text-lg font-extrabold text-foreground">
              {stats.focusHoursFormatted}
            </p>
          </div>

          <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5 text-teal-400" /> Questions Solved
            </p>
            <p className="mt-1 font-display text-lg font-extrabold text-foreground">
              {stats.questionsSolved}
            </p>
          </div>

          <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Accuracy
            </p>
            <p className="mt-1 font-display text-lg font-extrabold text-foreground">
              {stats.accuracy}%
            </p>
          </div>

          <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers className="h-3.5 w-3.5 text-amber-400" /> Flashcards
            </p>
            <p className="mt-1 font-display text-lg font-extrabold text-foreground">
              {stats.flashcardsReviewed}
            </p>
          </div>
        </div>

        {/* Topics Studied Pill List */}
        {stats.topicsStudiedList.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-primary" /> Topics Studied This Week
            </p>
            <div className="flex flex-wrap gap-1.5">
              {stats.topicsStudiedList.map((t, idx) => (
                <span
                  key={idx}
                  className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Weak Topics Warning */}
        {stats.weakTopicsCount > 0 && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2.5 text-xs text-rose-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{stats.weakTopicsCount} topics currently marked as weak or decaying in retention.</span>
          </div>
        )}

        {/* AI Interpretation Strip */}
        <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Brain className="h-3.5 w-3.5" /> AI Interpretation
            </span>
            {!aiAnalysis && (
              <Button
                size="sm"
                variant="outline"
                onClick={fetchWeeklyAiAnalysis}
                disabled={loadingAi}
                className="h-7 text-xs gap-1 border-primary/30"
              >
                <Sparkles className="h-3 w-3" />
                {loadingAi ? "Analyzing..." : "Generate AI Review"}
              </Button>
            )}
          </div>
          {aiAnalysis && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              "{aiAnalysis}"
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

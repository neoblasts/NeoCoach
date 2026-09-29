import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { localClient } from "@/api/localStorageClient";
import { Button } from "@/components/ui/button";
import { cn } from "@/libs/utils";
import { Loader2, Timer, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

export default function NextBestAction() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWhy, setShowWhy] = useState(false);

  const fetchRecommendation = async () => {
    setLoading(true);
    try {
      const res = await localClient.functions.invoke("learningCoach", { operation: "recommend" });
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendation();
  }, []);

  if (loading) {
    return (
      <div className="lifeos-surface flex h-32 items-center justify-center rounded-lg">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.result || !data.signals) {
    return null; // No recommendation available
  }

  const { result, signals } = data;

  const startFocus = () => {
    const params = new URLSearchParams({
      preset: "custom",
      subjectId: signals.subject_id || "",
      assignmentId: signals.assignment_id || "",
      label: `${signals.subjectName} — ${signals.topicName || signals.actionTitle}`.trim(),
    });
    if (signals.topic_id) params.set("topic_id", signals.topic_id);
    navigate(`/focus?${params.toString()}`);
  };

  return (
    <div className="lifeos-panel overflow-hidden rounded-lg p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Next Best Action</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold">{signals.subjectName}</p>
          <p className="text-sm text-muted-foreground">{signals.topicName || signals.actionTitle}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {signals.mastery > 0 && (
              <span className={cn("font-medium", signals.mastery < 40 ? "text-rose-500" : signals.mastery < 70 ? "text-amber-500" : "text-emerald-500")}>
                Mastery: {signals.mastery}%
              </span>
            )}
            <span>· {signals.recommendedDuration} min recommended</span>
            {signals.daysUntilDeadline <= 7 && (
              <span className="font-medium text-amber-500">· Due in {signals.daysUntilDeadline}d</span>
            )}
          </div>
        </div>
        <Button onClick={startFocus} className="shrink-0 gap-1.5 rounded-lg">
          <Timer className="h-4 w-4" /> Start Focus
        </Button>
      </div>

      {/* Why this? */}
      <button
        onClick={() => setShowWhy(!showWhy)}
        className="mt-4 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {showWhy ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Why this?
      </button>
      {showWhy && (
        <div className="lifeos-soft-panel mt-3 space-y-2 rounded-lg p-4">
          <p className="text-sm font-medium">{result.headline}</p>
          {result.reasons?.length > 0 && (
            <ul className="space-y-1.5">
              {result.reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">•</span> {r}
                </li>
              ))}
            </ul>
          )}
          {result.encouragement && (
            <p className="pt-1 text-xs italic text-muted-foreground">{result.encouragement}</p>
          )}
          <p className="pt-1 text-xs text-muted-foreground/70">
            Recommendations are based on your deadlines, mastery estimates, and recent activity. They are suggestions, not commands.
          </p>
        </div>
      )}
    </div>
  );
}

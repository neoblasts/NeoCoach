import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAILearningReview } from "@/libs/dashboardIntelligence";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Sparkles,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  TrendingUp,
  Target,
} from "lucide-react";

export default function AILearningReviewCard() {
  const navigate = useNavigate();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadReview = async () => {
    setLoading(true);
    try {
      const data = await fetchAILearningReview();
      setReview(data);
    } catch {
      setReview(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReview();
  }, []);

  const handleStartReview = () => {
    if (!review?.recommendedTopic) {
      navigate("/learn");
      return;
    }
    const params = new URLSearchParams({
      label: `Review: ${review.recommendedTopic}`,
      preset: "custom",
    });
    navigate(`/focus?${params.toString()}`);
  };

  return (
    <div className="lifeos-surface flex flex-col justify-between rounded-xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.14)]">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Brain className="h-3.5 w-3.5" />
            </div>
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
              AI Learning Review
            </h3>
          </div>
          <button
            onClick={loadReview}
            disabled={loading}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
            title="Refresh review"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-3 space-y-3">
          {loading && !review ? (
            <div className="space-y-2 py-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-12 animate-pulse rounded bg-muted/60" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ) : review ? (
            <>
              {/* What changed? */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                  <TrendingUp className="h-3 w-3" />
                  <span>What changed?</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {review.whatChanged}
                </p>
              </div>

              {/* Needs attention */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-400">
                  <AlertCircle className="h-3 w-3" />
                  <span>Needs attention</span>
                </div>
                <p className="text-xs font-semibold text-foreground">
                  {review.needsAttention}
                </p>
              </div>

              {/* Pattern detected */}
              {review.patternDetected && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                    <Target className="h-3 w-3" />
                    <span>Pattern detected</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {review.patternDetected}
                  </p>
                </div>
              )}

              {/* Recommended */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs">
                <p className="text-[11px] font-bold text-primary">Recommended Action</p>
                <p className="mt-0.5 text-muted-foreground">{review.recommendedAction}</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Study session data is being aggregated.</p>
          )}
        </div>
      </div>

      {/* Action Footer */}
      {review && (
        <div className="mt-4 pt-2 border-t border-border/40">
          <Button
            size="sm"
            onClick={handleStartReview}
            className="w-full h-8 gap-1.5 rounded-lg text-xs font-semibold"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Start Recommended Review</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

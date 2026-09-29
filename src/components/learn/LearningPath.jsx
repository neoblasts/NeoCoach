import { useState } from "react";
import { cn } from "@/libs/utils";
import { computeMastery, masteryColor } from "@/libs/mastery";
import { CheckCircle2, Circle, ArrowRight, Brain } from "lucide-react";

export default function LearningPath({ subjects, topics, events }) {
  const [selectedSubject, setSelectedSubject] = useState("");

  const filteredTopics = selectedSubject
    ? topics.filter((t) => t.subject_id === selectedSubject)
    : [];

  const topicsWithMastery = filteredTopics.map((t) => ({
    ...t,
    mastery: computeMastery(events, t.id),
  }));

  // Sort by mastery ascending — weakest first
  const sorted = [...topicsWithMastery].sort((a, b) => a.mastery.score - b.mastery.score);

  return (
    <div className="space-y-4">
      <select
        value={selectedSubject}
        onChange={(e) => setSelectedSubject(e.target.value)}
        className="flex h-9 rounded-md border border-input bg-secondary/35 px-3 py-1 text-sm text-foreground outline-none transition hover:border-primary/25 focus:border-ring"
      >
        <option value="">Choose a subject</option>
        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      {selectedSubject && sorted.length === 0 ? (
        <div className="lifeos-surface rounded-lg py-12 text-center">
          <Brain className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No topics yet. Add topics to see your learning path.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((topic) => {
            const m = topic.mastery;
            const isWeak = m.score < 40;
            const isStrong = m.score >= 70;
            const isReviewed = m.attempts > 0;
            return (
              <div key={topic.id} className="flex items-center gap-3">
                {/* Status icon */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                  {!isReviewed ? (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  ) : isStrong ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <ArrowRight className={cn("h-5 w-5", isWeak ? "text-rose-500" : "text-amber-500")} />
                  )}
                </div>

                {/* Topic info */}
                <div className="lifeos-soft-panel min-w-0 flex-1 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="truncate font-medium">{topic.name}</p>
                    <span className={cn("text-sm font-bold tabular-nums", masteryColor(m.score))}>
                      {isReviewed ? `${m.score}%` : "—"}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        m.score >= 70 ? "bg-emerald-500" : m.score >= 40 ? "bg-amber-500" : "bg-rose-500"
                      )}
                      style={{ width: `${m.score}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {isReviewed ? (
                      <>
                        <span>{m.accuracy}% accuracy</span>
                        <span>· {m.attempts} attempts</span>
                        {m.daysSinceReview < 999 && <span>· {m.daysSinceReview}d ago</span>}
                      </>
                    ) : (
                      <span className="italic">Not reviewed yet</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedSubject && sorted.length > 0 && (
        <p className="pt-2 text-xs text-muted-foreground/70">
          Topics are ordered by mastery — weakest first. Mastery is an estimate based on your learning activity, not a definitive measure.
        </p>
      )}
    </div>
  );
}

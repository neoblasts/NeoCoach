import { cn } from "@/libs/utils";
import { masteryBarColor, masteryColor } from "@/libs/mastery";

export default function MasteryBar({ score, confidence, accuracy, attempts, lastReviewed, compact }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <span className={cn("font-display text-2xl font-bold", masteryColor(score))}>{score}%</span>
        {confidence && (
          <span className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            confidence === "high" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : confidence === "medium" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
          )}>
            {confidence} confidence
          </span>
        )}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", masteryBarColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      {!compact && (
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          {accuracy !== undefined && <span>{accuracy}% accuracy</span>}
          {attempts !== undefined && <span>· {attempts} attempts</span>}
          {lastReviewed && <span>· reviewed {timeAgo(lastReviewed)}</span>}
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr || dateStr === "never") return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
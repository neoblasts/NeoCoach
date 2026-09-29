import { Brain, Coffee, MoonStar, CheckCircle2, AlertCircle } from "lucide-react";
import { formatDuration, timeAgo } from "@/libs/focusUtils";
import { cn } from "@/libs/utils";
import EmptyState from "@/components/EmptyState";

const MODE_ICON = { focus: Brain, short_break: Coffee, long_break: MoonStar };
const MODE_LABEL = { focus: "Focus session", short_break: "Short break", long_break: "Long break" };

export default function FocusHistory({ sessions, subjectMap }) {
  const recent = sessions.slice(0, 10);

  if (recent.length === 0) {
    return (
      <EmptyState
        icon={Brain}
        title="No sessions yet"
        description="Your focus history will appear here after your first session."
        className="py-8"
      />
    );
  }

  return (
    <div className="space-y-2">
      {recent.map((s) => {
        const Icon = MODE_ICON[s.mode] || Brain;
        const completed = s.status === "completed";
        const isFocus = s.mode === "focus";
        return (
          <div key={s.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                isFocus ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-500"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.label || MODE_LABEL[s.mode]}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatDuration(s.actual_duration_seconds || s.planned_duration_seconds)}
                {s.subject_id && subjectMap[s.subject_id] ? ` · ${subjectMap[s.subject_id].name}` : ""}
                {" · "}{timeAgo(s.started_at)}
              </p>
            </div>
            {completed ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            )}
          </div>
        );
      })}
    </div>
  );
}
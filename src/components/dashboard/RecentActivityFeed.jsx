import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  AlertTriangle,
  Award,
  HelpCircle,
  Timer,
  FileText,
  Brain,
  Activity,
} from "lucide-react";
import { cn } from "@/libs/utils";

export default function RecentActivityFeed({ events = [] }) {
  const formattedEvents = useMemo(() => {
    return events.slice(0, 8).map((e) => {
      const type = e.event_type || e.type || "";
      const isCorrect = e.is_correct;
      const topic = e.topic_name || e.topic || "Study material";
      const time = e.created_date || e.created_at || new Date().toISOString();

      let icon = CheckCircle2;
      let tone = "success";
      let title = `Studied ${topic}`;
      let subtitle = "Learning activity logged";

      if (type === "card_answered" || type === "flashcard_reviewed") {
        if (isCorrect) {
          icon = CheckCircle2;
          tone = "success";
          title = `Reviewed ${topic}`;
          subtitle = e.rating ? `Self-rating: ${e.rating}` : "Spaced flashcard recall";
        } else {
          icon = AlertTriangle;
          tone = "warning";
          title = `Struggled with ${topic}`;
          subtitle = "Needs reinforcement review";
        }
      } else if (type === "flashcard_mastered") {
        icon = Award;
        tone = "success";
        title = `Mastered ${topic}`;
        subtitle = "Spaced repetition milestone reached";
      } else if (type === "quiz_completed" || type === "quiz_answered") {
        icon = HelpCircle;
        tone = "primary";
        title = `Quiz: ${topic}`;
        subtitle = e.score !== null && e.total !== null ? `Score: ${e.score}/${e.total}` : "Practice test completed";
      } else if (type === "focus_session_completed" || type === "study_session_completed") {
        icon = Timer;
        tone = "primary";
        const mins = Math.round((e.duration_seconds || 0) / 60);
        title = `${mins > 0 ? `${mins}m ` : ""}Focus Session Completed`;
        subtitle = topic !== "Study material" ? `Focused on ${topic}` : "Deep work session";
      } else if (type === "document_studied") {
        icon = FileText;
        tone = "neutral";
        title = `Studied notes: ${topic}`;
        subtitle = "Theory & document revision";
      } else if (type === "coach_session_completed") {
        icon = Brain;
        tone = "accent";
        title = `Coach session on ${topic}`;
        subtitle = "Active recall & Socratic dialogue";
      }

      let timeAgo = "Just now";
      try {
        timeAgo = formatDistanceToNow(new Date(time), { addSuffix: true });
      } catch {}

      return {
        id: e.id || Math.random().toString(),
        icon,
        tone,
        title,
        subtitle,
        timeAgo,
      };
    });
  }, [events]);

  if (formattedEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
        <Activity className="h-6 w-6 text-muted-foreground/40 mb-2" />
        <p className="font-semibold text-foreground">No recent activity</p>
        <p className="mt-1">Complete a flashcard review or study session to see your activity timeline.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {formattedEvents.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-card/60 p-2.5 transition hover:border-primary/30 hover:bg-accent/30"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs",
                  item.tone === "success" && "bg-emerald-500/10 text-emerald-400",
                  item.tone === "warning" && "bg-amber-500/10 text-amber-400",
                  item.tone === "primary" && "bg-primary/10 text-primary",
                  item.tone === "accent" && "bg-cyan-500/10 text-cyan-400",
                  item.tone === "neutral" && "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">{item.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{item.subtitle}</p>
              </div>
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground/70">{item.timeAgo}</span>
          </div>
        );
      })}
    </div>
  );
}

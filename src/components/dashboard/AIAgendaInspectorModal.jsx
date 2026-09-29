import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { localClient } from "@/api/localStorageClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { dueLabel, formatTime } from "@/libs/dates";
import { cn } from "@/libs/utils";
import {
  Sparkles,
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Clock,
  ArrowRight,
  Brain,
  CheckCircle2,
  ListTodo,
  Loader2,
  RefreshCw,
} from "lucide-react";

export default function AIAgendaInspectorModal({
  open,
  onOpenChange,
  assignments = [],
  tasks = [],
  events = [],
  subjects = [],
}) {
  const navigate = useNavigate();
  const [analyzing, setAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);

  const subjectMap = useMemo(() => {
    const m = {};
    subjects.forEach((s) => (m[s.id] = s.name));
    return m;
  }, [subjects]);

  const now = new Date();
  const todayStr = now.toDateString();

  // Filter urgent & upcoming items
  const urgentAssignments = useMemo(() => {
    return assignments
      .filter((a) => a.status !== "graded" && a.status !== "submitted" && a.completed !== true)
      .sort((a, b) => new Date(a.due_date || "2099") - new Date(b.due_date || "2099"))
      .slice(0, 6);
  }, [assignments]);

  const todayEvents = useMemo(() => {
    return events
      .filter((e) => new Date(e.start_date) >= now || new Date(e.start_date).toDateString() === todayStr)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      .slice(0, 5);
  }, [events, todayStr]);

  const openTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== "done" && t.completed !== true).slice(0, 5);
  }, [tasks]);

  const runAIScan = async () => {
    setAnalyzing(true);
    try {
      const res = await localClient.functions.invoke("learningCoach", {
        operation: "recommend",
        context: {
          assignmentsCount: urgentAssignments.length,
          eventsCount: todayEvents.length,
          openTasksCount: openTasks.length,
        },
      });

      if (res?.data?.result) {
        setAiInsight(res.data.result);
      } else {
        setAiInsight({
          headline: "Focus on High-Priority Deadlines First",
          reasons: [
            urgentAssignments.length > 0 ? `You have ${urgentAssignments.length} pending assignment(s) coming up soon.` : "No urgent assignments due immediately.",
            todayEvents.length > 0 ? `You have ${todayEvents.length} calendar event(s) scheduled.` : "Calendar is open for deep study today.",
          ],
          encouragement: "Allocating 45 minutes of focused study now will keep you ahead of your workload.",
        });
      }
    } catch {
      setAiInsight({
        headline: "Deterministic Schedule Briefing",
        reasons: [
          `Review your top ${urgentAssignments.length} pending assignment(s) and ${todayEvents.length} scheduled event(s).`,
        ],
        encouragement: "Consistent daily progress prevents last-minute exam stress.",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStartFocus = (assignment) => {
    onOpenChange(false);
    const params = new URLSearchParams({
      preset: "custom",
      subjectId: assignment?.subject_id || "",
      assignmentId: assignment?.id || "",
      label: assignment?.title ? `Focus: ${assignment.title}` : "Study Session",
    });
    navigate(`/focus?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl border bg-card/95 p-6 backdrop-blur-xl">
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-extrabold tracking-tight">
                AI Agenda & Schedule Inspector
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                AI-synthesized briefing across your deadlines, events, and tasks.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs rounded-lg"
            onClick={runAIScan}
            disabled={analyzing}
          >
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {analyzing ? "Scanning…" : "Re-Scan with AI"}
          </Button>
        </DialogHeader>

        <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* AI Briefing Banner */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <Brain className="h-4 w-4 shrink-0" />
              <span>AI Study Planning Recommendation</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-foreground">
              {aiInsight?.headline || (urgentAssignments.length > 0 ? `Prioritize "${urgentAssignments[0]?.title}" today.` : "Your schedule is clear — ideal for deep focus or revision.")}
            </p>
            {aiInsight?.reasons?.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {aiInsight.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-primary font-bold">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Upcoming Deadlines Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-foreground">
                <ClipboardList className="h-4 w-4 text-amber-400" /> Upcoming Assignments & Deadlines ({urgentAssignments.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] text-primary hover:underline p-0"
                onClick={() => { onOpenChange(false); navigate("/assignments"); }}
              >
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>

            {urgentAssignments.length === 0 ? (
              <div className="rounded-xl border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                No upcoming assignments or deadlines due soon.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {urgentAssignments.map((a) => {
                  const dl = dueLabel(a.due_date);
                  const overdue = dl?.tone === "overdue";
                  return (
                    <div
                      key={a.id}
                      className="group flex flex-col justify-between rounded-xl border bg-card/70 p-3 text-xs transition-all hover:border-primary/40 hover:bg-accent/30"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-semibold text-foreground truncate">{a.title}</p>
                          {dl && (
                            <span className={cn("text-[10px] font-bold shrink-0", overdue ? "text-rose-400" : "text-amber-400")}>
                              {overdue && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}{dl.text}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground truncate">
                          {subjectMap[a.subject_id] || "General"} · {a.type || "Homework"}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/40">
                        <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{a.priority || "normal"}</span>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={() => handleStartFocus(a)}
                        >
                          <Clock className="h-3 w-3" /> Start Focus
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Today's Calendar Events */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-foreground">
                <CalendarDays className="h-4 w-4 text-blue-400" /> Scheduled Events & Classes ({todayEvents.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] text-primary hover:underline p-0"
                onClick={() => { onOpenChange(false); navigate("/calendar"); }}
              >
                Open Calendar <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>

            {todayEvents.length === 0 ? (
              <div className="rounded-xl border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                No calendar events scheduled for today.
              </div>
            ) : (
              <div className="space-y-1.5">
                {todayEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-xl border bg-card/60 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                      <p className="font-semibold text-foreground truncate">{e.title}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                      {formatTime(e.start_date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from "react";
import { localClient } from "@/api/localStorageClient";
import { useEntityList } from "@/hooks/useEntity";
import { buildKnowledgeGraph } from "@/libs/knowledgeGraph";
import { getColor } from "@/libs/subjectColors";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import SubjectFormDialog from "@/components/forms/SubjectFormDialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/libs/utils";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Timer,
  ClipboardList,
  CheckCircle2,
  Circle,
  Network,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  Brain,
  TrendingUp,
  AlertCircle,
  BarChart2,
} from "lucide-react";

export default function Subjects() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState("overview"); // "overview" | "graph"
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const {
    data: subjects,
    loading,
    reload,
  } = useEntityList(() => localClient.entities.Subject.list());

  const {
    data: assignments,
    reload: reloadAssignments,
  } = useEntityList(() => localClient.entities.Assignment.list());

  const {
    data: topics,
  } = useEntityList(() => localClient.entities.Topic.list());

  const {
    data: sessions,
  } = useEntityList(() => localClient.entities.FocusSession.list("-created_date", 500));

  const {
    data: learningEvents,
  } = useEntityList(() => localClient.entities.LearningEvent.list("-created_date", 500));

  // Build the live DAG Knowledge Graph
  const graph = useMemo(() => buildKnowledgeGraph(), [topics.length, subjects.length, learningEvents.length]);

  // ───────────────────────────────────────────────────────────────────────────
  // Assignment statistics by subject
  // ───────────────────────────────────────────────────────────────────────────

  const subjectStats = useMemo(() => {
    const stats = {};

    subjects.forEach((subject) => {
      stats[subject.id] = {
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
      };
    });

    const now = new Date();

    assignments.forEach((assignment) => {
      const subjectId = assignment.subject_id;
      if (!subjectId) return;

      if (!stats[subjectId]) {
        stats[subjectId] = {
          total: 0,
          completed: 0,
          pending: 0,
          overdue: 0,
        };
      }

      stats[subjectId].total += 1;
      const isCompleted =
        assignment.status === "submitted" ||
        assignment.status === "graded" ||
        assignment.completed === true;

      if (isCompleted) {
        stats[subjectId].completed += 1;
      } else {
        stats[subjectId].pending += 1;
        if (assignment.due_date) {
          const dueDate = new Date(assignment.due_date);
          if (!Number.isNaN(dueDate.getTime()) && dueDate < now) {
            stats[subjectId].overdue += 1;
          }
        }
      }
    });

    Object.keys(stats).forEach((id) => {
      const item = stats[id];
      item.progress = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
    });

    return stats;
  }, [subjects, assignments]);

  // ───────────────────────────────────────────────────────────────────────────
  // Detailed Study Analytics by Subject, Chapter, Time Slot & Time Studied
  // ───────────────────────────────────────────────────────────────────────────

  const studyAnalytics = useMemo(() => {
    const subjectStudyMap = {};
    const hourDistribution = new Array(24).fill(0);
    let totalMinutesStudied = 0;

    subjects.forEach((s) => {
      subjectStudyMap[s.id] = {
        totalMinutes: 0,
        sessionCount: 0,
        chapterBreakdown: {},
        peakSlot: "N/A",
      };
    });

    sessions.forEach((sess) => {
      const mins = Math.round((sess.duration_seconds || 0) / 60) || sess.duration_minutes || 0;
      totalMinutesStudied += mins;

      // Extract time slot hour
      if (sess.created_date || sess.created_at) {
        const date = new Date(sess.created_date || sess.created_at);
        if (!isNaN(date.getTime())) {
          hourDistribution[date.getHours()] += mins;
        }
      }

      if (sess.subject_id && subjectStudyMap[sess.subject_id]) {
        subjectStudyMap[sess.subject_id].totalMinutes += mins;
        subjectStudyMap[sess.subject_id].sessionCount += 1;
      }
    });

    // Determine primary study time slot window
    let maxSlotMins = 0;
    let peakHour = 14;
    hourDistribution.forEach((mins, h) => {
      if (mins > maxSlotMins) {
        maxSlotMins = mins;
        peakHour = h;
      }
    });

    const formatHour = (h) => {
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${h12}:00 ${ampm}`;
    };

    const primarySlotLabel = `${formatHour(peakHour)} – ${formatHour((peakHour + 2) % 24)}`;

    return {
      subjectStudyMap,
      totalMinutesStudied,
      primarySlotLabel,
      hourDistribution,
    };
  }, [subjects, sessions]);

  // ───────────────────────────────────────────────────────────────────────────
  // Dialog Actions
  // ───────────────────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (subject, e) => {
    e.stopPropagation();
    setEditing(subject);
    setDialogOpen(true);
  };

  const handleDelete = (id, name, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      localClient.entities.Subject.delete(id);
      toast({ title: "Subject deleted", description: `"${name}" has been removed.` });
      reload();
      reloadAssignments?.();
    } catch {
      toast({ title: "Delete failed", description: "Could not delete this subject.", variant: "destructive" });
    }
  };

  const handleSaved = () => {
    reload();
    reloadAssignments?.();
    setDialogOpen(false);
  };

  const startFocus = (subject) => {
    navigate(`/focus?subjectId=${encodeURIComponent(subject.id)}&label=${encodeURIComponent(subject.name)}`);
  };

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col overflow-hidden gap-3">
      <PageHeader
        title="Subjects & Knowledge Graph"
        subtitle="Manage your courses, study time allocation, chapters, and dynamic mastery DAG visualizer."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-muted p-1 border">
              <button
                onClick={() => setActiveView("overview")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition",
                  activeView === "overview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <BookOpen className="h-3.5 w-3.5" /> Overview
              </button>
              <button
                onClick={() => setActiveView("graph")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition",
                  activeView === "graph" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Network className="h-3.5 w-3.5" /> Knowledge Graph
              </button>
            </div>
            <Button onClick={openNew} className="h-8 gap-1.5 rounded-lg text-xs">
              <Plus className="h-3.5 w-3.5" /> New subject
            </Button>
          </div>
        }
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : activeView === "graph" ? (
          /* ───────────────────────────────────────────────────────────────────
             KNOWLEDGE GRAPH & CHAPTER STUDY VISUALIZER
          ─────────────────────────────────────────────────────────────────── */
          <div className="space-y-5 pb-6">
            {/* Top Study Factors Banner */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-card/60 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Clock className="h-4 w-4 text-primary" /> Total Time Studied
                </div>
                <p className="mt-2 font-display text-2xl font-bold text-foreground">
                  {Math.floor(studyAnalytics.totalMinutesStudied / 60)}h {studyAnalytics.totalMinutesStudied % 60}m
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Across all recorded focus sessions</p>
              </div>

              <div className="rounded-xl border bg-card/60 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Calendar className="h-4 w-4 text-amber-400" /> Peak Study Time Slot
                </div>
                <p className="mt-2 font-display text-2xl font-bold text-foreground">
                  {studyAnalytics.primarySlotLabel}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Highest concentration window</p>
              </div>

              <div className="rounded-xl border bg-card/60 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-emerald-400" /> Syllabus Coverage
                </div>
                <p className="mt-2 font-display text-2xl font-bold text-foreground">
                  {graph.stats.masteredCount} / {graph.stats.totalTopics} <span className="text-xs font-normal text-muted-foreground">Mastered</span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Average Mastery: {graph.stats.averageMastery}%</p>
              </div>
            </div>

            {/* Subject & Chapter Node Graph Visualizer */}
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div>
                  <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                    <Network className="h-4 w-4 text-primary" /> Academic Knowledge Graph DAG
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Hierarchical layout of Subjects → Chapters → Topics mapped by study time & mastery.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Mastered</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Learning</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Weak</span>
                </div>
              </div>

              {subjects.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No subjects found. Create a subject to visualize your knowledge graph.</p>
              ) : (
                <div className="space-y-6">
                  {subjects.map((subj) => {
                    const subjGraph = graph.subjects[subj.id];
                    const color = getColor(subj.color);
                    const studyInfo = studyAnalytics.subjectStudyMap[subj.id] || { totalMinutes: 0, sessionCount: 0 };
                    const subjTopics = Object.values(graph.topics).filter((t) => t.subjectId === subj.id);

                    // Group by chapter
                    const chapters = {};
                    subjTopics.forEach((t) => {
                      const ch = t.chapter || "Core Concepts";
                      if (!chapters[ch]) chapters[ch] = [];
                      chapters[ch].push(t);
                    });

                    return (
                      <div key={subj.id} className="rounded-xl border bg-muted/20 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3 mb-4">
                          <div className="flex items-center gap-2.5">
                            <div className={cn("h-3.5 w-3.5 rounded-full", color.bg || "bg-primary")} />
                            <h4 className="font-bold text-sm text-foreground">{subj.name}</h4>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {subjTopics.length} topics
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Time Studied: <strong className="text-foreground">{studyInfo.totalMinutes} mins</strong></span>
                            <span>Mastery: <strong className="text-foreground">{subjGraph?.mastery || 0}%</strong></span>
                          </div>
                        </div>

                        {/* Chapters & Topic Nodes */}
                        {Object.keys(chapters).length === 0 ? (
                          <p className="text-xs text-muted-foreground italic py-2">No chapters or topics added yet for this subject.</p>
                        ) : (
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {Object.entries(chapters).map(([chapterName, chapterTopics]) => (
                              <div key={chapterName} className="rounded-lg border bg-card p-3 shadow-2xs">
                                <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-2.5">
                                  <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                                    <Layers className="h-3.5 w-3.5 text-primary" /> {chapterName}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">{chapterTopics.length} concepts</span>
                                </div>
                                <div className="space-y-2">
                                  {chapterTopics.map((topic) => {
                                    const stageBg =
                                      topic.stage === "MASTERED"
                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                        : topic.stage === "WEAK" || topic.stage === "FORGOTTEN"
                                        ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                                        : "border-blue-500/30 bg-blue-500/10 text-blue-400";

                                    return (
                                      <div key={topic.id} className={cn("flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs", stageBg)}>
                                        <div className="min-w-0 flex-1 pr-2">
                                          <p className="font-medium truncate text-[11px]">{topic.name}</p>
                                          {topic.prerequisites.length > 0 && (
                                            <p className="text-[9px] text-muted-foreground truncate">Requires: {topic.prerequisites.length} prereq(s)</p>
                                          )}
                                        </div>
                                        <div className="text-right shrink-0">
                                          <span className="font-bold text-[11px]">{topic.mastery}%</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : subjects.length === 0 ? (
          /* ───────────────────────────────────────────────────────────────────
             Empty state
          ─────────────────────────────────────────────────────────────────── */
          <EmptyState
            icon={BookOpen}
            title="No subjects yet"
            description="Add a subject to start tracking assignments, notes, and study sessions."
            action={
              <Button onClick={openNew} className="gap-1.5 rounded-full">
                <Plus className="h-4 w-4" /> Add a subject
              </Button>
            }
          />
        ) : (
          /* ───────────────────────────────────────────────────────────────────
             Subject cards (Overview View)
          ─────────────────────────────────────────────────────────────────── */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => {
              const color = getColor(subject.color);
              const stats = subjectStats[subject.id] || {
                total: 0,
                completed: 0,
                pending: 0,
                overdue: 0,
                progress: 0,
              };
              const studyInfo = studyAnalytics.subjectStudyMap[subject.id] || { totalMinutes: 0, sessionCount: 0 };
              const subjGraph = graph.subjects[subject.id];

              return (
                <div
                  key={subject.id}
                  className="group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className={cn("absolute right-0 top-0 h-28 w-28 rounded-bl-full opacity-80", color.soft)} />

                  <div className="relative p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold shadow-xs", color.bg, "text-white")}>
                          {subject.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-display text-base font-bold text-foreground group-hover:text-primary">
                            {subject.name}
                          </h3>
                          {subject.code && (
                            <p className="text-xs font-mono text-muted-foreground">{subject.code}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={(e) => openEdit(subject, e)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={(e) => handleDelete(subject.id, subject.name, e)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stats strip */}
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-muted/60 px-2 py-2">
                        <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                          <ClipboardList className="h-3 w-3" /> Assignments
                        </div>
                        <p className="mt-1 text-sm font-semibold">{stats.total}</p>
                      </div>

                      <div className="rounded-xl bg-muted/60 px-2 py-2">
                        <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" /> Studied
                        </div>
                        <p className="mt-1 text-sm font-semibold">{studyInfo.totalMinutes}m</p>
                      </div>

                      <div className="rounded-xl bg-muted/60 px-2 py-2">
                        <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                          <Brain className="h-3 w-3" /> Mastery
                        </div>
                        <p className="mt-1 text-sm font-semibold">{subjGraph?.mastery || 0}%</p>
                      </div>
                    </div>

                    {/* Assignment progress bar */}
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Assignment completion</span>
                        <span className="font-medium">{stats.progress}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full transition-all duration-500", color.bg || "bg-primary")} style={{ width: `${stats.progress}%` }} />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 flex items-center justify-between border-t pt-3">
                      <div className="min-w-0">
                        {subject.target_grade ? (
                          <span className="text-xs font-medium text-foreground">Target: {subject.target_grade}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No target grade</span>
                        )}
                      </div>

                      <button onClick={() => startFocus(subject)} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors", color.soft, color.text, "hover:opacity-80")}>
                        <Timer className="h-3.5 w-3.5" /> Focus
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SubjectFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={handleSaved}
        subject={editing}
      />
    </div>
  );
}
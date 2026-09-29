import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { localClient } from "@/api/localStorageClient";
import { useEntityList } from "@/hooks/useEntity";
import { dueLabel } from "@/libs/dates";
import { PriorityBadge, SubjectBadge, TopicBadge, AssignmentTypeBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import { cn } from "@/libs/utils";
import {
  ListTodo,
  ClipboardList,
  CalendarDays,
  BookOpen,
  AlertTriangle,
  Circle,
  CheckCircle2,
  Timer,
  ClipboardCheck,
  ExternalLink,
  Zap,
  Sparkles,
  TrendingUp,
  Layers,
  HelpCircle,
  Brain,
  Award,
  RefreshCw,
} from "lucide-react";
import { formatDuration, getTodayFocusSeconds, getTodaySessionCount, calculateStreak } from "@/libs/focusUtils";
import { computeNextBestAction } from "@/libs/decisionEngine";
import { buildKnowledgeGraph } from "@/libs/knowledgeGraph";
import NextBestActionCard from "@/components/dashboard/NextBestActionCard";
import AILearningReviewCard from "@/components/dashboard/AILearningReviewCard";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";
import DailyPlannerStrip from "@/components/dashboard/DailyPlannerStrip";
import WeeklyReviewModal from "@/components/dashboard/WeeklyReviewModal";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setProfile(localClient.profile.get());
  }, []);

  const { data: tasks, loading: loadingTasks, reload: reloadTasks } = useEntityList(() => localClient.entities.Task.list("-updated_date", 100));
  const { data: assignments, loading: loadingAsg, reload: reloadAssignments } = useEntityList(() => localClient.entities.Assignment.list("-due_date", 100));
  const { data: subjects = [], reload: reloadSubjects } = useEntityList(() => localClient.entities.Subject.list());
  const { data: topics = [], reload: reloadTopics } = useEntityList(() => localClient.entities.Topic.list("name", 500));
  const { data: focusSessions = [], reload: reloadSessions } = useEntityList(() => localClient.entities.FocusSession.list("-started_at", 500));
  const { data: learningEvents = [], reload: reloadEvents } = useEntityList(() => localClient.entities.LearningEvent.list("-created_date", 200));

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([
      reloadTasks?.(),
      reloadAssignments?.(),
      reloadSubjects?.(),
      reloadTopics?.(),
      reloadSessions?.(),
      reloadEvents?.(),
    ]);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  // Compute Knowledge Graph and Next Best Action 100% locally
  const graph = useMemo(() => buildKnowledgeGraph(), [topics.length, subjects.length, learningEvents.length]);
  const nextAction = useMemo(() => computeNextBestAction(graph), [graph, assignments]);

  const topicMap = useMemo(() => {
    const m = {};
    topics.forEach((t) => (m[t.id] = t));
    return m;
  }, [topics]);

  const subjectById = useMemo(() => {
    const m = new Map();
    subjects.forEach((s) => m.set(s.id, s));
    return m;
  }, [subjects]);

  const now = new Date();
  const todayStr = now.toDateString();

  const isDone = (t) => t.status === "done" || t.status === "submitted" || t.status === "graded" || t.completed === true;

  const openTasks = tasks.filter((t) => !isDone(t));
  const tasksDueToday = tasks.filter((t) => t.due_date && new Date(t.due_date).toDateString() === todayStr && !isDone(t));
  const overdueTasks = tasks.filter((t) => t.due_date && new Date(t.due_date).toDateString() !== todayStr && new Date(t.due_date) < now && !isDone(t));
  const assignmentsDueToday = assignments.filter((a) => a.due_date && new Date(a.due_date).toDateString() === todayStr && !isDone(a));
  const overdueAssignments = assignments.filter((a) => a.due_date && new Date(a.due_date).toDateString() !== todayStr && new Date(a.due_date) < now && !isDone(a));

  const focusItems = [
    ...overdueAssignments.map((a) => ({ ...a, _kind: "assignment" })),
    ...overdueTasks.map((t) => ({ ...t, _kind: "task" })),
    ...assignmentsDueToday.map((a) => ({ ...a, _kind: "assignment" })),
    ...tasksDueToday.map((t) => ({ ...t, _kind: "task" })),
  ].slice(0, 6);

  const todayFocus = getTodayFocusSeconds(focusSessions);
  const todaySessions = getTodaySessionCount(focusSessions);
  const focusStreak = calculateStreak(focusSessions);

  const toggleTask = async (task) => {
    await localClient.entities.Task.update(task.id, { status: task.status === "done" ? "todo" : "done" });
    reloadTasks();
  };

  const readinessScore = Math.min(100, Math.round(graph.stats.averageMastery * 0.7 + (focusStreak > 0 ? 15 : 5) + Math.min(15, todaySessions * 5)));

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* ── TOP HEADER: Greeting + High-level KPIs + Session launcher ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground">
            {greeting()}{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Personal Study OS · Ready for today's adaptive learning goals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="h-8 gap-1.5 text-xs rounded-lg border-border/80 text-muted-foreground hover:text-foreground"
            title="Refresh dashboard data and charts"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-primary", isRefreshing && "animate-spin")} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh Data"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeeklyOpen(true)}
            className="h-8 gap-1.5 text-xs rounded-lg border-border/80"
          >
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            <span>Weekly Review</span>
          </Button>

          <Link to="/focus">
            <Button size="sm" className="h-8 gap-1.5 text-xs rounded-lg bg-primary font-bold shadow-sm">
              <Timer className="h-3.5 w-3.5" />
              <span>Start Study Session</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* ── HIGH LEVEL KPI STATS (Phase 2) ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Exam Readiness */}
        <div className="lifeos-surface rounded-xl p-3.5 transition hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Exam Readiness</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-display text-2xl font-extrabold text-foreground">{readinessScore}%</p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${readinessScore}%` }} />
          </div>
        </div>

        {/* Study Time Today */}
        <div className="lifeos-surface rounded-xl p-3.5 transition hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Study Time</span>
            <Timer className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 font-display text-2xl font-extrabold text-foreground">{formatDuration(todayFocus)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {todaySessions} session{todaySessions !== 1 ? "s" : ""}
            {focusStreak > 0 && <span className="text-orange-400 font-semibold ml-1">· {focusStreak}d streak</span>}
          </p>
        </div>

        {/* Topics Mastered */}
        <div className="lifeos-surface rounded-xl p-3.5 transition hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Mastered Topics</span>
            <Award className="h-4 w-4 text-teal-400" />
          </div>
          <p className="mt-2 font-display text-2xl font-extrabold text-foreground">
            {graph.stats.masteredCount} <span className="text-xs font-normal text-muted-foreground">/ {graph.stats.totalTopics}</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Avg mastery: {graph.stats.averageMastery}%
          </p>
        </div>

        {/* Open Priorities */}
        <div className="lifeos-surface rounded-xl p-3.5 transition hover:border-primary/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Pending Items</span>
            <ListTodo className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 font-display text-2xl font-extrabold text-foreground">{openTasks.length + overdueAssignments.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {overdueTasks.length + overdueAssignments.length} overdue
          </p>
        </div>
      </div>

      {/* ── NEXT BEST ACTION (Phase 2 & Phase 9) ── */}
      <NextBestActionCard recommendation={nextAction.primary} />

      {/* ── MAIN DASHBOARD GRID ── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">

        {/* LEFT COLUMN: Daily Planner + Recent Activity + Priorities */}
        <div className="space-y-4 min-w-0">

          {/* Daily Study Planner (Phase 20) */}
          <DailyPlannerStrip />

          {/* Recent Activity Timeline (Phase 16) */}
          <div className="lifeos-surface rounded-xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.14)]">
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5 mb-3">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
                Recent Learning Activity
              </h3>
              <span className="text-[11px] text-muted-foreground">Logged locally</span>
            </div>
            <RecentActivityFeed events={learningEvents} />
          </div>

          {/* Action Items & Priorities */}
          <div className="lifeos-surface rounded-xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.14)]">
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5 mb-3">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
                Action Items & Deadlines
              </h3>
              <div className="flex items-center gap-2 text-xs">
                <Link to="/tasks" className="text-primary hover:underline font-medium">Tasks</Link>
                <span className="text-muted-foreground/40">·</span>
                <Link to="/assignments" className="text-primary hover:underline font-medium">Assignments</Link>
              </div>
            </div>

            {focusItems.length === 0 ? (
              <div className="flex items-center justify-center p-6 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 mr-2" />
                <span>You're all caught up! No overdue assignments or tasks.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {focusItems.map((item) => {
                  const dl = dueLabel(item.due_date);
                  const overdue = dl?.tone === "overdue";
                  const subject = subjectById.get(item.subject_id);

                  if (item._kind === "assignment") {
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigate("/assignments")}
                        className="flex w-full items-center gap-3 rounded-lg border border-border/40 bg-card/60 p-2.5 text-left transition hover:border-primary/40 hover:bg-accent/30"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                          <ClipboardCheck className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-semibold text-foreground">{item.title}</p>
                            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {subject && <SubjectBadge subject={subject} />}
                            {item.topic_id && <TopicBadge topic={topicMap[item.topic_id]} />}
                            <AssignmentTypeBadge type={item.type} />
                            <PriorityBadge priority={item.priority} />
                            {dl && (
                              <span className={cn("text-[11px]", overdue ? "font-medium text-rose-500" : "text-muted-foreground")}>
                                {overdue && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}{dl.text}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  }

                  return (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/60 p-2.5">
                      <button onClick={() => toggleTask(item)} className="shrink-0 text-muted-foreground hover:text-primary transition">
                        {item.status === "done" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">{item.title}</p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <PriorityBadge priority={item.priority} />
                          {dl && (
                            <span className={cn("text-[11px]", overdue ? "font-medium text-rose-500" : "text-muted-foreground")}>
                              {overdue && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}{dl.text}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: AI Learning Review + Knowledge Graph Summary + Quick Navigation */}
        <div className="space-y-4">

          {/* AI Learning Review (Phase 17) */}
          <AILearningReviewCard />

          {/* Knowledge Graph / Mastery Status */}
          <div className="lifeos-surface rounded-xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.14)]">
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5 mb-3">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
                Knowledge State
              </h3>
              <Link to="/subjects" className="text-xs text-primary hover:underline font-medium">
                View Graph
              </Link>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Mastered (90%+)
                </span>
                <span className="font-bold tabular-nums text-foreground">{graph.stats.masteredCount} topics</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> In Learning (50–89%)
                </span>
                <span className="font-bold tabular-nums text-foreground">{graph.stats.learningCount} topics</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> Weak / Forgotten (&lt;50%)
                </span>
                <span className="font-bold tabular-nums text-rose-400">{graph.stats.weakCount} topics</span>
              </div>
            </div>

            {/* Quick Actions Strip */}
            <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-2 gap-2">
              <Link to="/learn?tab=cards">
                <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5 rounded-lg border-border/60">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span>Flashcards</span>
                </Button>
              </Link>

              <Link to="/learn?tab=quiz">
                <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5 rounded-lg border-border/60">
                  <HelpCircle className="h-3.5 w-3.5 text-primary" />
                  <span>Quizzes</span>
                </Button>
              </Link>

              <Link to="/study-coach" className="col-span-2">
                <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5 rounded-lg border-border/60">
                  <Brain className="h-3.5 w-3.5 text-primary" />
                  <span>Ask Student Coach</span>
                </Button>
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Weekly Review Modal */}
      <WeeklyReviewModal open={weeklyOpen} onOpenChange={setWeeklyOpen} />
    </div>
  );
}

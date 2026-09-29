import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { localClient } from "@/api/localStorageClient";
import { aiChat, isAIConfigured } from "@/libs/aiProviders";
import AIFormattedText from "@/components/AIFormattedText";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/libs/utils";
import {
  Sparkles,
  Target,
  Brain,
  CheckCircle2,
  AlertCircle,
  Timer,
  BookOpen,
  RefreshCw,
  Loader2,
  Zap,
  Maximize2,
  FileText,
  Activity,
  Bot,
  TrendingUp,
  Award,
} from "lucide-react";

const CACHE_KEY = "lifeos_dashboard_live_ai_audit_cache_v3";

export default function AIExecutiveStudyReport({
  subjects = [],
  topics = [],
  assignments = [],
  notes = [],
  sessions = [],
  learningEvents = [],
  aiInteractions = [],
  tasks = [],
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const subjectMap = useMemo(() => {
    const m = {};
    subjects.forEach((s) => (m[s.id] = s));
    return m;
  }, [subjects]);

  const topicMap = useMemo(() => {
    const m = {};
    topics.forEach((t) => (m[t.id] = t));
    return m;
  }, [topics]);

  // Compute local data metrics for auditing
  const metrics = useMemo(() => {
    const totalNotes = notes.length;
    const recentNote = notes[0] || null;
    const daysSinceLastNote = recentNote
      ? Math.floor((new Date() - new Date(recentNote.created_at || recentNote.created_date)) / 86400000)
      : 999;

    const totalRevisions = learningEvents.length;
    const correctRevisions = learningEvents.filter(
      (e) => e.is_correct || e.rating === "easy" || e.rating === "good"
    ).length;
    const recallRate = totalRevisions > 0 ? Math.round((correctRevisions / totalRevisions) * 100) : 0;

    const totalAIInteractions = aiInteractions.length;
    const recentAIInteraction = aiInteractions[0] || null;
    const daysSinceLastAI = recentAIInteraction
      ? Math.floor((new Date() - new Date(recentAIInteraction.created_at)) / 86400000)
      : 999;

    const overdueAssignments = assignments.filter(
      (a) => a.due_date && new Date(a.due_date) < new Date() && a.status !== "graded" && a.status !== "submitted"
    );
    const overdueTasks = tasks.filter(
      (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done"
    );

    return {
      totalNotes,
      recentNote,
      daysSinceLastNote,
      hasRecentNotes: daysSinceLastNote <= 3,
      totalRevisions,
      recallRate,
      hasRecentRevisions: totalRevisions > 0,
      totalAIInteractions,
      daysSinceLastAI,
      hasRecentAI: daysSinceLastAI <= 4,
      overdueCount: overdueAssignments.length + overdueTasks.length,
      overdueAssignments,
    };
  }, [notes, learningEvents, aiInteractions, assignments, tasks]);

  // Deterministic local audit fallback generator
  const generateLocalAudit = () => {
    const notesStatus = metrics.totalNotes === 0 ? "Inactive" : metrics.daysSinceLastNote <= 2 ? "Active" : "Slacking";
    const revisionStatus = metrics.totalRevisions === 0 ? "Inactive" : metrics.recallRate >= 70 ? "High" : "Moderate";
    const aiUsageStatus = metrics.totalAIInteractions === 0 ? "Inactive" : metrics.daysSinceLastAI <= 3 ? "Active" : "Moderate";

    const primaryTarget = metrics.overdueAssignments[0]
      ? {
          title: metrics.overdueAssignments[0].title,
          subjectName: subjectMap[metrics.overdueAssignments[0].subject_id]?.name || "General",
          subjectId: metrics.overdueAssignments[0].subject_id,
          topicId: metrics.overdueAssignments[0].topic_id,
          reason: "Imminent overdue deadline requires immediate study focus.",
        }
      : topics[0]
      ? {
          title: topics[0].name,
          subjectName: subjectMap[topics[0].subject_id]?.name || "General",
          subjectId: topics[0].subject_id,
          topicId: topics[0].id,
          reason: "Recommended priority topic for retention reinforcement.",
        }
      : {
          title: "Core Subject Review",
          subjectName: subjects[0]?.name || "General Study",
          subjectId: subjects[0]?.id || null,
          topicId: null,
          reason: "Establish a daily study routine by reviewing core concepts.",
        };

    const notesSummary =
      metrics.totalNotes > 0
        ? `You have created ${metrics.totalNotes} note(s). ${
            metrics.hasRecentNotes ? "Good job maintaining consistent notes!" : "Note creation has slowed down recently."
          }`
        : "No notes logged yet. Regular note-taking accelerates memory retention by 40%.";

    const revisionSummary =
      metrics.totalRevisions > 0
        ? `${metrics.totalRevisions} topic revisions recorded with a ${metrics.recallRate}% recall accuracy rate.`
        : "Topic revisions are inactive. Regular spaced repetition prevents knowledge decay.";

    const aiUsageSummary =
      metrics.totalAIInteractions > 0
        ? `You have engaged with the AI Study Coach ${metrics.totalAIInteractions} time(s) for concept clarification.`
        : "You haven't asked the AI Study Coach questions yet. Ask live questions to clear doubts quickly.";

    const fullAuditMarkdown = `
# 📊 Preliminary Executive Study Audit

### Audit Verdict: ${notesStatus === "Active" && revisionStatus === "High" ? "Strong Momentum" : "Needs Consistency & Revision Acceleration"}

---

### 1. 📝 Notes Consistency Audit: **${notesStatus}**
${notesSummary}

### 2. 🔄 Topic Revision Audit: **${revisionStatus}**
${revisionSummary}

### 3. 🤖 AI Study Coach Engagement: **${aiUsageStatus}**
${aiUsageSummary}

---

### 🎯 Priority Study Roadmap
1. **Focus Action**: Start a 25-minute Pomodoro session on **${primaryTarget.title}** (${primaryTarget.subjectName}).
2. **Note Taking**: Summarize key concepts in a new note after your focus session.
3. **AI Consultation**: Ask the AI Study Coach 2 probing questions to test your depth of understanding.

*Click "Run Live Gemini AI Study Review" above for a real-time Gemini API audit of your study pattern.*
`.trim();

    return {
      verdictTitle: notesStatus === "Active" ? "Consistent Study Habit" : "Requires Action & Active Notes",
      notesStatus,
      revisionStatus,
      aiUsageStatus,
      notesSummary,
      revisionSummary,
      aiUsageSummary,
      primaryTarget,
      roadmap: [
        `Complete overdue item: ${primaryTarget.title}`,
        "Create at least 1 study note today",
        "Ask AI Study Coach to test your recall on weak topics",
      ],
      fullAuditMarkdown,
      generatedAt: new Date().toISOString(),
      isLiveAI: false,
    };
  };

  // Run Real Live Gemini API Audit Call
  const runLiveAIAudit = async () => {
    setLoading(true);
    try {
      const recentNotesTitles = notes.slice(0, 5).map((n) => n.title).join(", ");
      const overdueTitles = metrics.overdueAssignments.slice(0, 3).map((a) => a.title).join(", ");
      const recentTopicsNames = topics.slice(0, 5).map((t) => t.name).join(", ");

      const prompt = `
You are an elite, sharp, and highly supportive AI Study Audit Coach in LifeOS.
Perform a real-time performance audit of the student's study habits using their actual database activity metrics:

--- STUDENT DATABASE ACTIVITY METRICS ---
1. NOTES CONSISTENCY:
- Total Notes Written: ${metrics.totalNotes}
- Recent Note Titles: ${recentNotesTitles || "None written yet"}
- Days Since Last Note: ${metrics.daysSinceLastNote === 999 ? "Never" : `${metrics.daysSinceLastNote} days ago`}

2. TOPIC REVISION & RECALL HABIT:
- Total Revision/Quiz Events: ${metrics.totalRevisions}
- Quiz Recall Accuracy Rate: ${metrics.recallRate}%
- Topics Registered: ${recentTopicsNames || "None created"}

3. LIVE AI STUDY COACH ENGAGEMENT:
- Total AI Coach Questions/Interactions: ${metrics.totalAIInteractions}
- Days Since Last AI Interaction: ${metrics.daysSinceLastAI === 999 ? "Never" : `${metrics.daysSinceLastAI} days ago`}

4. ACADEMIC PRIORITY & DEADLINES:
- Overdue Items Count: ${metrics.overdueCount}
- Overdue Titles: ${overdueTitles || "None"}
- Total Subjects Enrolled: ${subjects.length}

--- AUDIT INSTRUCTIONS ---
Perform a strict, intelligent audit. Even if activity counts are low or zero, DO NOT say "I don't have enough data". Audit low metrics directly as "Inactive" or "Slacking" and provide an urgent restart plan.

Format your response strictly as valid JSON with NO markdown code block wrappers around it. Use this exact schema:
{
  "verdictTitle": "Short 4-6 word executive verdict title",
  "notesStatus": "Active" | "Moderate" | "Slacking" | "Inactive",
  "revisionStatus": "High" | "Moderate" | "Overdue" | "Inactive",
  "aiUsageStatus": "Active" | "Moderate" | "Low" | "Inactive",
  "notesSummary": "2 short sentences evaluating if notes are written regularly.",
  "revisionSummary": "2 short sentences evaluating topic revisions and recall.",
  "aiUsageSummary": "2 short sentences evaluating live AI Study Coach questions.",
  "primaryTarget": {
    "title": "Exact title of the specific topic or task to study next",
    "subjectName": "Subject name",
    "reason": "Clear explanation of why this topic must be studied next based on their pattern."
  },
  "roadmap": [
    "Step 1 actionable guidance",
    "Step 2 actionable guidance",
    "Step 3 actionable guidance"
  ],
  "fullAuditMarkdown": "Comprehensive markdown report evaluating notes, topic revision habits, live AI engagement, and a study plan with math formulas if relevant."
}
`.trim();

      let parsed = null;
      let rawResponse = "";

      try {
        rawResponse = await aiChat(prompt, [], { source: "executive_audit" });
        if (rawResponse) {
          const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (err) {
        console.warn("Live AI Gemini audit invocation warning:", err);
      }

      let finalAudit = null;
      if (parsed && parsed.verdictTitle) {
        const targetSubject = subjects.find(
          (s) => s.name?.toLowerCase() === parsed.primaryTarget?.subjectName?.toLowerCase()
        ) || subjects[0];

        finalAudit = {
          verdictTitle: parsed.verdictTitle,
          notesStatus: parsed.notesStatus || "Moderate",
          revisionStatus: parsed.revisionStatus || "Moderate",
          aiUsageStatus: parsed.aiUsageStatus || "Moderate",
          notesSummary: parsed.notesSummary || "Notes audit completed by Gemini AI.",
          revisionSummary: parsed.revisionSummary || "Revision audit completed by Gemini AI.",
          aiUsageSummary: parsed.aiUsageSummary || "AI Study Coach usage analyzed.",
          primaryTarget: {
            title: parsed.primaryTarget?.title || "Priority Focus Session",
            subjectName: targetSubject?.name || parsed.primaryTarget?.subjectName || "General Study",
            subjectId: targetSubject?.id || null,
            topicId: null,
            reason: parsed.primaryTarget?.reason || "Recommended by Gemini AI based on your active metrics.",
          },
          roadmap: parsed.roadmap || ["Study key topic", "Take structured notes", "Review with AI Coach"],
          fullAuditMarkdown: parsed.fullAuditMarkdown || rawResponse || "Gemini audit complete.",
          generatedAt: new Date().toISOString(),
          isLiveAI: true,
        };
      } else if (rawResponse) {
        // AI returned text but not strict JSON — build rich object wrapping rawResponse
        const fallbackObj = generateLocalAudit();
        fallbackObj.fullAuditMarkdown = rawResponse;
        fallbackObj.isLiveAI = true;
        fallbackObj.verdictTitle = "Gemini Live AI Performance Review";
        finalAudit = fallbackObj;
      } else {
        finalAudit = generateLocalAudit();
      }

      setAuditData(finalAudit);
      setLastUpdated(new Date(finalAudit.generatedAt));
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          generatedAt: finalAudit.generatedAt,
          data: finalAudit,
        })
      );
    } finally {
      setLoading(false);
    }
  };

  // Initial load from cache or local generator
  useEffect(() => {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      try {
        const cached = JSON.parse(raw);
        setAuditData(cached.data);
        setLastUpdated(new Date(cached.generatedAt));
        return;
      } catch {}
    }
    const initial = generateLocalAudit();
    setAuditData(initial);
    setLastUpdated(new Date(initial.generatedAt));
  }, []);

  const handleStartFocus = () => {
    if (!auditData?.primaryTarget) return;
    const target = auditData.primaryTarget;
    const params = new URLSearchParams({
      preset: "pomodoro",
      subjectId: target.subjectId || "",
      label: `${target.subjectName} — ${target.title}`.trim(),
    });
    if (target.topicId) params.set("topic_id", target.topicId);
    navigate(`/focus?${params.toString()}`);
  };

  const getStatusBadge = (status, type) => {
    const colors = {
      Active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      High: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      Moderate: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      Slacking: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      Overdue: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      Inactive: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      Low: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    };
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", colors[status] || colors.Moderate)}>
        {status}
      </span>
    );
  };

  return (
    <>
      <div className="lifeos-surface flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border p-3.5 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0 shadow-sm shadow-primary/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-bold leading-none">AI Study Performance Audit</h2>
                {auditData?.isLiveAI && (
                  <span className="rounded bg-primary/20 px-1.5 py-0.2 text-[9px] font-extrabold text-primary uppercase tracking-widest">
                    Gemini Live
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {auditData?.verdictTitle || "Real-time habit & review audit"}
              </p>
            </div>
          </div>

          {/* Trigger Button for Gemini AI Call */}
          <Button
            size="sm"
            className="h-7 gap-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-primary via-indigo-500 to-purple-600 hover:opacity-95 text-white shadow-sm shadow-primary/25"
            onClick={runLiveAIAudit}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            )}
            <span>{loading ? "Auditing..." : "Run Live AI Review"}</span>
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground space-y-2">
            <div className="relative flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <Brain className="h-4 w-4 text-primary absolute animate-ping" />
            </div>
            <p className="font-semibold text-foreground">Invoking Gemini AI Study Auditor…</p>
            <p className="text-[11px] max-w-[240px]">
              Analyzing your notes frequency, topic revisions, and AI Coach interactions.
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 text-xs">
            {/* Priority Study Target Card */}
            {auditData?.primaryTarget && (
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 h-16 w-16 bg-primary/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-primary text-[11px] font-bold uppercase tracking-wider">
                    <Target className="h-3.5 w-3.5" /> Next Study Target
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Based on study pattern
                  </span>
                </div>
                <div>
                  <p className="text-sm font-black text-foreground">{auditData.primaryTarget.title}</p>
                  <p className="text-[11px] text-primary/90 font-semibold">{auditData.primaryTarget.subjectName}</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {auditData.primaryTarget.reason}
                </p>
                <Button
                  size="sm"
                  className="w-full h-7 gap-1.5 rounded-lg text-xs font-bold mt-1 shadow-sm"
                  onClick={handleStartFocus}
                >
                  <Timer className="h-3.5 w-3.5" /> Start Focus Session
                </Button>
              </div>
            )}

            {/* 3 Pillar Audits */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-0.5">
                3-Pillar Audit Breakdown
              </div>

              {/* 1. Notes Habit */}
              <div className="rounded-xl border bg-card/60 p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-foreground text-[11px]">
                    <FileText className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span>Notes Consistency</span>
                  </div>
                  {getStatusBadge(auditData?.notesStatus || "Slacking", "notes")}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {auditData?.notesSummary}
                </p>
              </div>

              {/* 2. Revision Rate */}
              <div className="rounded-xl border bg-card/60 p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-foreground text-[11px]">
                    <Activity className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span>Topic Revision Rate</span>
                  </div>
                  {getStatusBadge(auditData?.revisionStatus || "Moderate", "revision")}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {auditData?.revisionSummary}
                </p>
              </div>

              {/* 3. AI Coach Engagement */}
              <div className="rounded-xl border bg-card/60 p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-foreground text-[11px]">
                    <Bot className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                    <span>AI Coach Engagement</span>
                  </div>
                  {getStatusBadge(auditData?.aiUsageStatus || "Inactive", "ai")}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {auditData?.aiUsageSummary}
                </p>
              </div>
            </div>

            {/* Expand Full Report Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 gap-1.5 text-xs rounded-lg border-dashed text-muted-foreground hover:text-foreground hover:border-primary/40"
              onClick={() => setShowModal(true)}
            >
              <Maximize2 className="h-3 w-3" /> View Full Gemini Audit Report
            </Button>
          </div>
        )}
      </div>

      {/* Detailed Full AI Audit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Full Gemini AI Study Audit Report</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Deep evaluation of notes regularity, topic revisions, AI Coach usage, and tailored study roadmap.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto pr-2 py-2">
            <div className="prose prose-invert max-w-none text-xs leading-relaxed">
              <AIFormattedText>{auditData?.fullAuditMarkdown}</AIFormattedText>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-3 mt-2">
            <span className="text-[11px] text-muted-foreground">
              {lastUpdated && `Audited on ${lastUpdated.toLocaleTimeString()}`}
            </span>
            <Button size="sm" onClick={() => setShowModal(false)}>
              Close Audit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


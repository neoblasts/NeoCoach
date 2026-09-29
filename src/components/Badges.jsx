import { getColor } from "@/libs/subjectColors";

export function SubjectBadge({ subject }) {
  if (!subject) return null;
  const c = getColor(subject.color);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${c.soft} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {subject.name}
    </span>
  );
}

const TOPIC_CLS = "border border-primary/20 bg-primary/10 text-primary";
export function TopicBadge({ topic }) {
  if (!topic) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TOPIC_CLS}`}>
      <svg className="mr-1 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      {topic.name}
    </span>
  );
}

const PRIORITY = {
  high: { label: "High", cls: "border border-rose-500/25 bg-rose-500/10 text-rose-300" },
  medium: { label: "Medium", cls: "border border-amber-500/25 bg-amber-500/10 text-amber-300" },
  low: { label: "Low", cls: "border border-border bg-muted/60 text-muted-foreground" },
};

export function PriorityBadge({ priority }) {
  const p = PRIORITY[priority] || PRIORITY.medium;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${p.cls}`}>{p.label}</span>;
}

const TASK_STATUS = {
  todo: { label: "To Do", cls: "border border-border bg-muted/60 text-muted-foreground" },
  in_progress: { label: "In Progress", cls: "border border-blue-500/25 bg-blue-500/10 text-blue-300" },
  done: { label: "Done", cls: "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300" },
};

const ASSIGN_STATUS = {
  not_started: { label: "Not Started", cls: "border border-border bg-muted/60 text-muted-foreground" },
  in_progress: { label: "In Progress", cls: "border border-blue-500/25 bg-blue-500/10 text-blue-300" },
  submitted: { label: "Submitted", cls: "border border-primary/25 bg-primary/10 text-primary" },
  graded: { label: "Graded", cls: "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300" },
};

const ASSIGN_TYPE = {
  homework: { label: "Homework", cls: "border border-primary/20 bg-primary/10 text-primary" },
  project: { label: "Project", cls: "border border-blue-500/20 bg-blue-500/10 text-blue-300" },
  essay: { label: "Essay", cls: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300" },
  lab: { label: "Lab", cls: "border border-cyan-500/20 bg-cyan-500/10 text-cyan-300" },
  reading: { label: "Reading", cls: "border border-amber-500/20 bg-amber-500/10 text-amber-300" },
  exam_prep: { label: "Exam Prep", cls: "border border-rose-500/20 bg-rose-500/10 text-rose-300" },
  presentation: { label: "Presentation", cls: "border border-sky-500/20 bg-sky-500/10 text-sky-300" },
  other: { label: "Other", cls: "border border-border bg-muted/60 text-muted-foreground" },
};

export function TaskStatusBadge({ status }) {
  const s = TASK_STATUS[status] || TASK_STATUS.todo;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export function AssignmentStatusBadge({ status }) {
  const s = ASSIGN_STATUS[status] || ASSIGN_STATUS.not_started;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export function StatusBadge({ status }) {
  if (TASK_STATUS[status]) return TaskStatusBadge({ status });
  return AssignmentStatusBadge({ status });
}

export function AssignmentTypeBadge({ type }) {
  const t = ASSIGN_TYPE[type] || ASSIGN_TYPE.other;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${t.cls}`}>{t.label}</span>;
}

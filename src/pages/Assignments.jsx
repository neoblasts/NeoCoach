import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { localClient } from "@/api/localStorageClient";
import { useEntityList } from "@/hooks/useEntity";
import { dueLabel } from "@/libs/dates";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import {
  PriorityBadge,
  SubjectBadge,
  TopicBadge,
  AssignmentStatusBadge,
  AssignmentTypeBadge,
} from "@/components/Badges";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectContent, SelectItem,
} from "@/components/ui/select";
import AssignmentFormDialog from "@/components/forms/AssignmentFormDialog";
import AssignmentWorkspace from "@/pages/AssignmentWorkspace";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/libs/utils";
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Timer,
  ArrowUpRight,
} from "lucide-react";

const STATUSES = [
  { value: "all", label: "All" },
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "submitted", label: "Submitted" },
  { value: "graded", label: "Graded" },
];

export default function Assignments() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    data: assignments,
    loading,
    reload,
  } = useEntityList(() =>
    localClient.entities.Assignment.list("-due_date", 200)
  );

  const { data: subjects } = useEntityList(() =>
    localClient.entities.Subject.list()
  );
  const { data: topics = [] } = useEntityList(() =>
    localClient.entities.Topic.list("name", 500)
  );

  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [workspaceId, setWorkspaceId] = useState(null);

  const subjectMap = useMemo(() => {
    const m = {};

    subjects.forEach((s) => {
      m[s.id] = s;
    });

    return m;
  }, [subjects]);

  const topicMap = useMemo(() => {
    const m = {};
    topics.forEach((t) => {
      m[t.id] = t;
    });
    return m;
  }, [topics]);

  const filtered = useMemo(() => {
    return assignments
      .filter(
        (a) =>
          statusFilter === "all" ||
          a.status === statusFilter
      )
      .filter(
        (a) =>
          subjectFilter === "all" ||
          a.subject_id === subjectFilter
      )
      .sort(
        (a, b) =>
          new Date(a.due_date || "2099") -
          new Date(b.due_date || "2099")
      );
  }, [assignments, statusFilter, subjectFilter]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (assignment) => {
    setEditing(assignment);
    setDialogOpen(true);
  };

  const openWorkspace = (assignment) => {
    setWorkspaceId(assignment.id);
  };

  const closeWorkspace = () => {
    setWorkspaceId(null);
    reload();
  };

  const updateStatus = async (assignment, nextStatus) => {
    try {
      await localClient.entities.Assignment.update(assignment.id, {
        status: nextStatus,
        updated_at: new Date().toISOString(),
        completed: nextStatus === "submitted" || nextStatus === "graded",
      });
      reload();
    } catch (error) {
      toast({
        title: "Could not update status",
        description: error?.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const remove = async (assignment) => {
    try {
      await localClient.entities.Assignment.delete(
        assignment.id
      );

      toast({
        title: "Assignment deleted",
      });

      reload();
    } catch (error) {
      toast({
        title: "Could not delete assignment",
        description:
          error?.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  /*
   * When an assignment is opened, render the full
   * Notion-style workspace instead of the list.
   */
  if (workspaceId) {
    return (
      <AssignmentWorkspace
        assignmentId={workspaceId}
        onBack={closeWorkspace}
      />
    );
  }

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col overflow-hidden gap-3">
      <PageHeader
        title="Assignments"
        subtitle="Homework, projects, and exams — sorted by what's due next."
        actions={
          <Button
            onClick={openNew}
            className="h-8 gap-1.5 rounded-lg text-xs"
            disabled={subjects.length === 0}
          >
            <Plus className="h-3.5 w-3.5" />
            New assignment
          </Button>
        }
      />

      {subjects.length === 0 && !loading && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Add a subject first before creating assignments.
        </div>
      )}

      {/* Filters */}
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((filter) => (
            <button
              key={filter.value}
              onClick={() =>
                setStatusFilter(filter.value)
              }
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                statusFilter === filter.value
                  ? "border border-primary/25 bg-primary/18 text-primary shadow-[0_10px_28px_rgba(32,199,201,0.14)]"
                  : "lifeos-pill"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {subjects.length > 0 && (
          <select
            value={subjectFilter}
            onChange={(e) =>
              setSubjectFilter(e.target.value)
            }
            className="ml-auto rounded-lg border border-input bg-secondary/35 px-4 py-2 text-sm text-foreground outline-none transition hover:border-primary/25 focus:border-ring"
          >
            <option value="all">
              All subjects
            </option>

            {subjects.map((subject) => (
              <option
                key={subject.id}
                value={subject.id}
              >
                {subject.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
                className="h-20 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments"
          description={
            subjects.length === 0
              ? "Create a subject first, then add assignments."
              : "Nothing matches your filters."
          }
          action={
            subjects.length > 0 ? (
              <Button
                onClick={openNew}
                className="gap-1.5 rounded-full"
              >
                <Plus className="h-4 w-4" />
                Add assignment
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((assignment) => {
            const dl = dueLabel(
              assignment.due_date
            );

            const overdue =
              dl?.tone === "overdue";

            return (
              <div
                key={assignment.id}
                className="lifeos-surface group rounded-lg p-4 transition-colors hover:border-primary/25"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  {/* Main assignment area */}
                  <button
                    onClick={() =>
                      openWorkspace(assignment)
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                        <ClipboardList className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">
                            {assignment.title}
                          </p>

                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <SubjectBadge
                            subject={
                              subjectMap[
                                assignment.subject_id
                              ]
                            }
                          />
                          {assignment.topic_id && (
                            <TopicBadge
                              topic={topicMap[assignment.topic_id]}
                            />
                          )}
                          <AssignmentTypeBadge type={assignment.type} />
                          {assignment.estimated_hours && (
                            <span className="text-xs text-muted-foreground">
                              ~
                              {
                                assignment.estimated_hours
                              }
                              h
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Right side */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <Select
                      value={assignment.status}
                      onValueChange={(v) => updateStatus(assignment, v)}
                    >
                      <SelectTrigger className="h-auto w-auto cursor-pointer border-none bg-transparent p-0 shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
                        <AssignmentStatusBadge
                          status={assignment.status}
                        />
                      </SelectTrigger>
                      <SelectContent align="end">
                        {STATUSES.filter((s) => s.value !== "all").map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <PriorityBadge
                      priority={assignment.priority}
                    />

                    {dl && (
                      <span
                        className={cn(
                          "text-xs font-medium",
                          overdue
                            ? "text-rose-500"
                            : dl.tone === "today"
                            ? "text-amber-500"
                            : "text-muted-foreground"
                        )}
                      >
                        {overdue && (
                          <AlertTriangle className="mr-1 inline h-3 w-3" />
                        )}
                        {dl.text}
                      </span>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          navigate(
                            `/focus?subjectId=${
                              assignment.subject_id ||
                              ""
                            }&assignmentId=${
                              assignment.id
                            }&label=${encodeURIComponent(
                              assignment.title
                            )}`
                          )
                        }
                        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                        aria-label="Start focus session"
                        title="Start focus session"
                      >
                        <Timer className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() =>
                          openEdit(assignment)
                        }
                        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label="Edit"
                        title="Edit assignment"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() =>
                          remove(assignment)
                        }
                        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                        aria-label="Delete"
                        title="Delete assignment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      <AssignmentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={reload}
        assignment={editing}
        subjects={subjects}
      />
    </div>
  );
}

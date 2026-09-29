import { useMemo, useState } from "react";
import { localClient } from "@/api/localStorageClient";
import { useEntityList } from "@/hooks/useEntity";
import { dueLabel } from "@/libs/dates";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { PriorityBadge, TaskStatusBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import TaskFormDialog from "@/components/forms/TaskFormDialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/libs/utils";
import { ListTodo, Plus, Pencil, Trash2, Circle, CheckCircle2, AlertTriangle } from "lucide-react";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

export default function Tasks() {
  const { toast } = useToast();
  const { data: tasks, loading, reload } = useEntityList(
    () => localClient.entities.Task.list("-updated_date", 200)
  );
  const [filter, setFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    if (filter === "all") return tasks;
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (task) => { setEditing(task); setDialogOpen(true); };

  const toggleDone = async (task) => {
    const next = task.status === "done" ? "todo" : "done";
    await localClient.entities.Task.update(task.id, { status: next });
    reload();
  };

  const remove = async (task) => {
    await localClient.entities.Task.delete(task.id);
    toast({ title: "Task deleted" });
    reload();
  };

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col overflow-hidden gap-3">
      <PageHeader
        title="Tasks"
        subtitle="Everything on your plate — personal, study, and admin."
        actions={<Button onClick={openNew} className="h-8 gap-1.5 rounded-lg text-xs"><Plus className="h-3.5 w-3.5" /> New task</Button>}
      />

      <div className="flex shrink-0 flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              filter === f.value
                ? "border border-primary/25 bg-primary/18 text-primary shadow-[0_10px_28px_rgba(32,199,201,0.14)]"
                : "lifeos-pill"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title={filter === "all" ? "No tasks yet" : "Nothing here"}
            description={filter === "all" ? "Create your first task to start organizing your day." : "Try a different filter."}
            action={<Button onClick={openNew} className="gap-1.5 rounded-lg text-xs"><Plus className="h-3.5 w-3.5" /> Add a task</Button>}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((task) => {
              const dl = dueLabel(task.due_date);
              const overdue = dl?.tone === "overdue";
              return (
                <div key={task.id} className="lifeos-surface group flex items-center gap-3 rounded-xl p-3 transition-all hover:border-primary/30">
                  <button onClick={() => toggleDone(task)} className="shrink-0 text-muted-foreground hover:text-primary">
                    {task.status === "done" ? <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" /> : <Circle className="h-4.5 w-4.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-xs font-semibold", task.status === "done" && "text-muted-foreground line-through")}>{task.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <TaskStatusBadge status={task.status} />
                      <PriorityBadge priority={task.priority} />
                      {task.category && <span className="text-[10px] capitalize text-muted-foreground">{task.category}</span>}
                      {dl && (
                        <span className={cn("text-[10px]", overdue ? "font-medium text-rose-500" : "text-muted-foreground")}>
                          {overdue && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}{dl.text}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => openEdit(task)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => remove(task)} className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-300" aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TaskFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={reload} task={editing} />
    </div>
  );
}

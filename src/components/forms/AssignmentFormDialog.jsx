import { useEffect, useMemo, useState } from "react";
import { localClient } from "@/api/localStorageClient";
import { useEntityList } from "@/hooks/useEntity";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const TYPES = [
  { value: "homework", label: "Homework" }, { value: "project", label: "Project" },
  { value: "essay", label: "Essay" }, { value: "lab", label: "Lab" },
  { value: "reading", label: "Reading" }, { value: "exam_prep", label: "Exam Prep" },
  { value: "presentation", label: "Presentation" }, { value: "other", label: "Other" },
];
const STATUSES = [
  { value: "not_started", label: "Not Started" }, { value: "in_progress", label: "In Progress" },
  { value: "submitted", label: "Submitted" }, { value: "graded", label: "Graded" },
];
const PRIORITIES = [
  { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
];

export default function AssignmentFormDialog({ open, onOpenChange, onSaved, assignment, subjects }) {
  const { toast } = useToast();
  const { data: topics = [] } = useEntityList(() => localClient.entities.Topic.list("name", 500));
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", subject_id: "", topic_id: "", type: "homework", status: "not_started", priority: "medium", due_date: "", description: "", estimated_hours: "",
  });

  const availableTopics = useMemo(
    () => topics.filter((t) => t.subject_id === form.subject_id),
    [topics, form.subject_id]
  );

  useEffect(() => {
    if (open) {
      const defaultSubject = assignment?.subject_id || (subjects[0]?.id || "");
      const rawTopicId = assignment?.topic_id || "";
      setForm({
        title: assignment?.title || "",
        subject_id: defaultSubject,
        topic_id: rawTopicId,
        type: assignment?.type || "homework",
        status: assignment?.status || "not_started",
        priority: assignment?.priority || "medium",
        due_date: assignment?.due_date || "",
        description: assignment?.description || "",
        estimated_hours: assignment?.estimated_hours ?? "",
      });
    }
  }, [open, assignment, subjects]);

  const set = (k, v) => setForm((f) => {
    if (k === "subject_id") {
      const next = { ...f, subject_id: v };
      const stillValid = topics.some((t) => t.id === f.topic_id && t.subject_id === v);
      if (!stillValid) next.topic_id = "";
      return next;
    }
    return { ...f, [k]: v };
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.subject_id) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        topic_id: form.topic_id || null,
        estimated_hours: form.estimated_hours === "" ? null : Number(form.estimated_hours),
        due_date: form.due_date || null,
        completed: form.status === "submitted" || form.status === "graded",
      };
      if (assignment?.id) {
        await localClient.entities.Assignment.update(assignment.id, payload);
        toast({ title: "Assignment updated" });
      } else {
        await localClient.entities.Assignment.create(payload);
        toast({ title: "Assignment created" });
      }
      onSaved?.();
      onOpenChange?.(false);
    } catch (err) {
      toast({ title: "Could not save assignment", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{assignment ? "Edit assignment" : "New assignment"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="asg-title">Title</Label>
            <Input id="asg-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Chapter 5 problem set" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={form.subject_id} onValueChange={(v) => set("subject_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Topic <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Select
              value={form.topic_id}
              onValueChange={(v) => set("topic_id", v)}
              disabled={!form.subject_id || availableTopics.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !form.subject_id
                    ? "Select a subject first"
                    : availableTopics.length === 0
                      ? "No topics for this subject yet"
                      : "Select topic"
                } />
              </SelectTrigger>
              <SelectContent>
                {availableTopics.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asg-hours">Est. hours</Label>
              <Input id="asg-hours" type="number" min="0" step="0.5" value={form.estimated_hours} onChange={(e) => set("estimated_hours", e.target.value)} placeholder="2" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asg-due">Due date</Label>
            <Input id="asg-due" type="date" value={form.due_date ? form.due_date.slice(0, 10) : ""} onChange={(e) => set("due_date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asg-desc">Description</Label>
            <Textarea id="asg-desc" value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Optional" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange?.(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.title.trim() || !form.subject_id}>{saving ? "Saving…" : "Save assignment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
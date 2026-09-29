import { useEffect, useState } from "react";
import { localClient } from "@/api/localStorageClient";
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

const CATEGORIES = [
  { value: "personal", label: "Personal" },
  { value: "study", label: "Study" },
  { value: "admin", label: "Admin" },
  { value: "home", label: "Home" },
  { value: "other", label: "Other" },
];
const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export default function TaskFormDialog({ open, onOpenChange, onSaved, task }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium", category: "personal", due_date: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        title: task?.title || "",
        description: task?.description || "",
        priority: task?.priority || "medium",
        category: task?.category || "personal",
        due_date: task?.due_date || "",
      });
    }
  }, [open, task]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, due_date: form.due_date || null };
      if (task?.id) {
        await localClient.entities.Task.update(task.id, payload);
        toast({ title: "Task updated" });
      } else {
        await localClient.entities.Task.create(payload);
        toast({ title: "Task created" });
      }
      onSaved?.();
      onOpenChange?.(false);
    } catch (err) {
      toast({ title: "Could not save task", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="What needs doing?" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea id="task-desc" value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Optional details" />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <Input id="task-due" type="date" value={form.due_date ? form.due_date.slice(0, 10) : ""} onChange={(e) => set("due_date", e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange?.(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.title.trim()}>{saving ? "Saving…" : "Save task"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
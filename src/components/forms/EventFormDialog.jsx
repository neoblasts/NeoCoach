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

const TYPES = [
  { value: "class", label: "Class" }, { value: "exam", label: "Exam" },
  { value: "deadline", label: "Deadline" }, { value: "study", label: "Study" },
  { value: "personal", label: "Personal" }, { value: "appointment", label: "Appointment" },
  { value: "other", label: "Other" },
];

function toLocalInput(d) {
  if (!d) return "";
  const date = new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EventFormDialog({ open, onOpenChange, onSaved, event, subjects, presetDate }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", start_date: "", end_date: "", all_day: false, type: "personal", subject_id: "",
  });

  useEffect(() => {
    if (open) {
      const baseStart = event?.start_date
        ? toLocalInput(event.start_date)
        : presetDate
          ? toLocalInput(presetDate)
          : "";
      setForm({
        title: event?.title || "",
        description: event?.description || "",
        start_date: baseStart,
        end_date: event?.end_date ? toLocalInput(event.end_date) : "",
        all_day: event?.all_day ?? false,
        type: event?.type || "personal",
        subject_id: event?.subject_id || "",
      });
    }
  }, [open, event, presetDate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.start_date) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        start_date: new Date(form.start_date).toISOString(),
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        all_day: form.all_day,
        type: form.type,
        subject_id: form.subject_id || null,
      };
      if (event?.id) {
        await localClient.entities.CalendarEvent.update(event.id, payload);
        toast({ title: "Event updated" });
      } else {
        await localClient.entities.CalendarEvent.create(payload);
        toast({ title: "Event added" });
      }
      onSaved?.();
      onOpenChange?.(false);
    } catch (err) {
      toast({ title: "Could not save event", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="evt-title">Title</Label>
            <Input id="evt-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Event title" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={form.subject_id} onValueChange={(v) => set("subject_id", v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="evt-start">Start</Label>
              <Input id="evt-start" type="datetime-local" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evt-end">End</Label>
              <Input id="evt-end" type="datetime-local" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="evt-desc">Description</Label>
            <Textarea id="evt-desc" value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Optional" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange?.(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.title.trim() || !form.start_date}>{saving ? "Saving…" : "Save event"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
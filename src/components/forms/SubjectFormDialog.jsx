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

const COLORS = [
  { value: "indigo", label: "Indigo" }, { value: "violet", label: "Violet" },
  { value: "blue", label: "Blue" }, { value: "emerald", label: "Emerald" },
  { value: "amber", label: "Amber" }, { value: "rose", label: "Rose" },
  { value: "cyan", label: "Cyan" }, { value: "orange", label: "Orange" },
  { value: "pink", label: "Pink" }, { value: "teal", label: "Teal" },
];

export default function SubjectFormDialog({ open, onOpenChange, onSaved, subject }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", color: "indigo", teacher: "", description: "", target_grade: "" });

  useEffect(() => {
    if (open) {
      setForm({
        name: subject?.name || "",
        code: subject?.code || "",
        color: subject?.color || "indigo",
        teacher: subject?.teacher || "",
        description: subject?.description || "",
        target_grade: subject?.target_grade || "",
      });
    }
  }, [open, subject]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (subject?.id) {
        await localClient.entities.Subject.update(subject.id, form);
        toast({ title: "Subject updated" });
      } else {
        await localClient.entities.Subject.create(form);
        toast({ title: "Subject added" });
      }
      onSaved?.();
      onOpenChange?.(false);
    } catch (err) {
      toast({ title: "Could not save subject", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{subject ? "Edit subject" : "New subject"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="subj-name">Subject name</Label>
            <Input id="subj-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Biology" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="subj-code">Course code</Label>
              <Input id="subj-code" value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="BIO 201" />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <Select value={form.color} onValueChange={(v) => set("color", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="subj-teacher">Teacher</Label>
              <Input id="subj-teacher" value={form.teacher} onChange={(e) => set("teacher", e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subj-grade">Target grade</Label>
              <Input id="subj-grade" value={form.target_grade} onChange={(e) => set("target_grade", e.target.value)} placeholder="A" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subj-desc">Description</Label>
            <Textarea id="subj-desc" value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Optional" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange?.(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>{saving ? "Saving…" : "Save subject"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
import { useState, useEffect } from "react";
import PresetSelector from "./PresetSelector";
import DurationStepper from "./DurationStepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Play, Volume2, Bell } from "lucide-react";

const SESSION_TYPES = [
  { value: "study", label: "Study" },
  { value: "personal", label: "Personal" },
  { value: "work", label: "Work" },
  { value: "other", label: "Other" },
];

export default function FocusSetup({ settings, onSettingsChange, subjects, topics, assignments, tasks, onStart, initial }) {
  const [preset, setPreset] = useState(initial?.preset || "pomodoro");
  const [label, setLabel] = useState(initial?.label || "");
  const [subjectId, setSubjectId] = useState(initial?.subjectId || "");
  const [topicId, setTopicId] = useState(initial?.topicId || "");
  const [assignmentId, setAssignmentId] = useState(initial?.assignmentId || "");
  const [taskId, setTaskId] = useState("");
  const [sessionType, setSessionType] = useState("study");

  useEffect(() => {
    if (initial?.preset) setPreset(initial.preset);
    if (initial?.label) setLabel(initial.label);
    if (initial?.subjectId) setSubjectId(initial.subjectId);
    if (initial?.topicId) setTopicId(initial.topicId);
    if (initial?.assignmentId) setAssignmentId(initial.assignmentId);
  }, [initial]);

  const filteredTopics = subjectId ? topics.filter((t) => t.subject_id === subjectId) : [];
  const filteredAssignments = subjectId
    ? assignments.filter((a) => a.subject_id === subjectId)
    : assignments;

  const updateSetting = (key, value) => onSettingsChange({ ...settings, [key]: value });

  const handleStart = () => onStart({ preset, label, subjectId, topicId, assignmentId, taskId, sessionType });

  const showFocusDuration = preset !== "short_break" && preset !== "long_break";
  const showShortBreakDuration = preset === "pomodoro" || preset === "custom_pomodoro" || preset === "short_break";
  const showLongBreakDuration = preset === "pomodoro" || preset === "custom_pomodoro" || preset === "long_break";
  const showSessions = preset === "pomodoro" || preset === "custom_pomodoro";

  return (
    <div className="space-y-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <PresetSelector value={preset} onChange={setPreset} />

      <div className="grid gap-3 sm:grid-cols-2">
        {showFocusDuration && (
          <DurationStepper label="Focus duration" value={settings.focusDuration} onChange={(v) => updateSetting("focusDuration", v)} min={1} max={180} />
        )}
        {showShortBreakDuration && (
          <DurationStepper label="Short break" value={settings.shortBreak} onChange={(v) => updateSetting("shortBreak", v)} min={1} max={60} />
        )}
        {showLongBreakDuration && (
          <DurationStepper label="Long break" value={settings.longBreak} onChange={(v) => updateSetting("longBreak", v)} min={1} max={60} />
        )}
        {showSessions && (
          <DurationStepper label="Sessions per cycle" value={settings.sessionsBeforeLongBreak} onChange={(v) => updateSetting("sessionsBeforeLongBreak", v)} min={2} max={10} unit="" />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleRow label="Auto-start breaks" checked={settings.autoStartBreaks} onChange={(v) => updateSetting("autoStartBreaks", v)} />
        <ToggleRow label="Auto-start next focus" checked={settings.autoStartNext} onChange={(v) => updateSetting("autoStartNext", v)} />
        <ToggleRow icon={Volume2} label="Sound effects" checked={settings.soundEnabled} onChange={(v) => updateSetting("soundEnabled", v)} />
        <ToggleRow icon={Bell} label="Notifications" checked={settings.notificationsEnabled} onChange={(v) => updateSetting("notificationsEnabled", v)} />
      </div>

      {settings.notificationsEnabled && (
        <div className="rounded-xl border bg-background/60 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="flex items-center gap-1.5"><Bell className="h-4 w-4 text-primary" /> Reminder Interval</span>
            <span className="text-muted-foreground">Every {settings.reminderIntervalMinutes || 10} min</span>
          </div>
          <DurationStepper
            label="Send reminders every"
            value={settings.reminderIntervalMinutes || 10}
            onChange={(v) => updateSetting("reminderIntervalMinutes", v)}
            min={1}
            max={60}
            unit="min"
          />
        </div>
      )}

      <div className="space-y-3 rounded-xl border bg-background/50 p-4">
        <div>
          <Label className="mb-1.5 block">Session label (optional)</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Chemistry revision" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block">Subject</Label>
            <SelectInput value={subjectId} onChange={(v) => { setSubjectId(v); setTopicId(""); setAssignmentId(""); }} options={subjects.map((s) => ({ value: s.id, label: s.name }))} placeholder="Choose subject" />
          </div>
          <div>
            <Label className="mb-1.5 block">Topic (optional)</Label>
            <SelectInput value={topicId} onChange={setTopicId} options={filteredTopics.map((t) => ({ value: t.id, label: t.name }))} placeholder="Choose topic" disabled={!subjectId} />
          </div>
          <div>
            <Label className="mb-1.5 block">Assignment</Label>
            <SelectInput value={assignmentId} onChange={setAssignmentId} options={filteredAssignments.map((a) => ({ value: a.id, label: a.title }))} placeholder="Choose assignment" disabled={!subjectId} />
          </div>
          <div>
            <Label className="mb-1.5 block">Task</Label>
            <SelectInput value={taskId} onChange={setTaskId} options={tasks.map((t) => ({ value: t.id, label: t.title }))} placeholder="Choose task" />
          </div>
          <div>
            <Label className="mb-1.5 block">Session type</Label>
            <SelectInput value={sessionType} onChange={setSessionType} options={SESSION_TYPES} />
          </div>
        </div>
      </div>

      <Button onClick={handleStart} size="lg" className="w-full gap-2 rounded-full text-base">
        <Play className="h-5 w-5" /> Start session
      </Button>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2.5">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SelectInput({ value, onChange, options, placeholder, disabled }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none transition-colors focus:border-ring disabled:opacity-50"
    >
      <option value="">{placeholder || "Select..."}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
import { useMemo, useState } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, format, parseISO, isToday as checkIsToday,
  addDays, subMonths, isSameYear
} from "date-fns";
import { localClient } from "@/api/localStorageClient";
import { useEntityList } from "@/hooks/useEntity";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import EventFormDialog from "@/components/forms/EventFormDialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/libs/utils";
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, Trash2, Clock,
  Calendar as CalendarIcon, Tag, BookOpen, Sparkles, Filter, CheckCircle2, AlertCircle
} from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TYPE_CONFIG = {
  class:       { label: "Class",       color: "bg-blue-500",    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  exam:        { label: "Exam",        color: "bg-rose-500",    badge: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  deadline:    { label: "Deadline",    color: "bg-amber-500",   badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  study:       { label: "Study",       color: "bg-primary",     badge: "bg-primary/10 text-primary border-primary/20" },
  personal:    { label: "Personal",    color: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  appointment: { label: "Appointment", color: "bg-cyan-500",    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  other:       { label: "Other",       color: "bg-purple-500",  badge: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
};

export default function Calendar() {
  const { toast } = useToast();
  const { data: events, reload } = useEntityList(() => localClient.entities.CalendarEvent.list("start_date", 200));
  const { data: subjects }       = useEntityList(() => localClient.entities.Subject.list());

  const [cursor, setCursor]         = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [activeFilter, setActiveFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [presetDate, setPresetDate] = useState(null);

  const subjectMap = useMemo(() => {
    const map = {};
    (subjects || []).forEach(s => { map[s.id] = s; });
    return map;
  }, [subjects]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end   = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const safeParseDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      if (typeof dateStr === "string") return parseISO(dateStr);
      return new Date(dateStr);
    } catch {
      return null;
    }
  };

  const filteredEvents = useMemo(() => {
    if (activeFilter === "all") return events;
    return events.filter(e => e.type === activeFilter);
  }, [events, activeFilter]);

  const eventsByDay = useMemo(() => {
    const m = {};
    filteredEvents.forEach((e) => {
      const d = safeParseDate(e.start_date);
      if (d && !isNaN(d.getTime())) {
        const key = format(d, "yyyy-MM-dd");
        (m[key] = m[key] || []).push(e);
      }
    });
    return m;
  }, [filteredEvents]);

  const selectedDayEvents = useMemo(() => {
    const key = format(selectedDay, "yyyy-MM-dd");
    return (eventsByDay[key] || []).sort((a, b) => {
      const da = safeParseDate(a.start_date);
      const db = safeParseDate(b.start_date);
      return (da?.getTime() || 0) - (db?.getTime() || 0);
    });
  }, [selectedDay, eventsByDay]);

  const openNew = (date) => {
    const targetDate = date || selectedDay || new Date();
    setEditing(null);
    setPresetDate(targetDate);
    setDialogOpen(true);
  };

  const openEdit = (e) => {
    setEditing(e);
    setPresetDate(null);
    setDialogOpen(true);
  };

  const handleSaved = () => {
    if (presetDate) {
      const d = new Date(presetDate);
      setSelectedDay(d);
      setCursor(d);
    }
    reload();
  };

  const remove = async (e, ev) => {
    ev?.stopPropagation();
    await localClient.entities.CalendarEvent.delete(e.id);
    toast({ title: "Event deleted" });
    reload();
  };

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col gap-4 overflow-hidden p-1 sm:p-2">

      {/* ── Top Bar / Header ── */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/60 p-4 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Academic Calendar</h1>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary border border-primary/20">
                {events.length} {events.length === 1 ? "Event" : "Events"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Manage your classes, exam dates, assignment deadlines, and personal milestones.</p>
          </div>
        </div>

        {/* Filter Pills & Add Event */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border bg-background/60 p-1 backdrop-blur-sm">
            <button
              onClick={() => setActiveFilter("all")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                activeFilter === "all" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            {Object.entries(TYPE_CONFIG).slice(0, 4).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                  activeFilter === key ? "bg-muted text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", cfg.color)} />
                {cfg.label}
              </button>
            ))}
          </div>

          <Button onClick={() => openNew(null)} size="sm" className="gap-1.5 rounded-xl shadow-sm hover:shadow transition-all">
            <Plus className="h-4 w-4" /> Add Event
          </Button>
        </div>
      </div>

      {/* ── Main Grid Layout ── */}
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[1fr_320px]">

        {/* LEFT PANEL: Month Grid */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md shadow-sm">
          
          {/* Controls bar */}
          <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-5 py-3 bg-muted/20">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-lg font-bold tracking-tight">
                {format(cursor, "MMMM yyyy")}
              </h2>
              {isSameMonth(cursor, new Date()) && isSameYear(cursor, new Date()) && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                  Current Month
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs font-medium gap-1 hover:bg-accent"
                onClick={() => { setCursor(new Date()); setSelectedDay(new Date()); }}
              >
                Today
              </Button>
              <div className="flex items-center rounded-lg border border-border bg-background/50 p-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setCursor(subMonths(cursor, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setCursor(addMonths(cursor, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Weekday Labels Header */}
          <div className="grid shrink-0 grid-cols-7 border-b border-border/30 bg-muted/10 text-center">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={cn(
                "py-2 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground",
                (i === 0 || i === 6) && "text-muted-foreground/70"
              )}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Days 6x7 Grid */}
          <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 divide-x divide-y divide-border/20 overflow-hidden bg-background/20">
            {days.map((day) => {
              const key           = format(day, "yyyy-MM-dd");
              const dayEvents     = eventsByDay[key] || [];
              const inMonth       = isSameMonth(day, cursor);
              const isToday       = checkIsToday(day);
              const isSelected    = isSameDay(day, selectedDay);

              return (
                <div
                  key={key}
                  onClick={() => setSelectedDay(day)}
                  onDoubleClick={() => openNew(day)}
                  className={cn(
                    "group relative flex flex-col justify-start p-1.5 sm:p-2 transition-all cursor-pointer overflow-hidden select-none",
                    !inMonth && "bg-muted/10 text-muted-foreground/40",
                    inMonth && "hover:bg-accent/40",
                    isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/40",
                    isToday && !isSelected && "bg-primary/5"
                  )}
                >
                  {/* Day header number & badge */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-all",
                      isToday
                        ? "bg-primary text-primary-foreground font-bold shadow-sm"
                        : isSelected
                        ? "bg-muted text-foreground font-bold"
                        : inMonth ? "text-foreground/90 group-hover:text-foreground" : "text-muted-foreground/40"
                    )}>
                      {format(day, "d")}
                    </span>

                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-semibold text-muted-foreground/70">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Event Chips */}
                  <div className="flex-1 space-y-1 overflow-hidden min-h-0">
                    {dayEvents.slice(0, 3).map((e) => {
                      const cfg = TYPE_CONFIG[e.type] || TYPE_CONFIG.other;
                      return (
                        <div
                          key={e.id}
                          onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}
                          className={cn(
                            "group/chip flex items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium border transition-all shadow-2xs hover:scale-[1.02]",
                            cfg.badge
                          )}
                          title={`${e.title} (${cfg.label})`}
                        >
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", cfg.color)} />
                          <span className="truncate leading-none">{e.title}</span>
                        </div>
                      );
                    })}

                    {dayEvents.length > 3 && (
                      <div className="px-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>

                  {/* Quick Add icon on hover */}
                  <button
                    onClick={(ev) => { ev.stopPropagation(); openNew(day); }}
                    className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50 shadow-2xs"
                    title="Add event on this date"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL: Selected Day Details & Upcoming */}
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">

          {/* Selected Day Agenda Box */}
          <div className="flex flex-1 min-h-0 flex-col rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md shadow-sm overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3 bg-muted/20">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Day Overview</p>
                <h3 className="font-display text-base font-bold text-foreground">
                  {format(selectedDay, "EEEE, MMM d")}
                </h3>
              </div>
              <Button onClick={() => openNew(selectedDay)} size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-accent">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Events for selected day */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
              {selectedDayEvents.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground mb-2">
                    <CalendarIcon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-medium text-foreground">No events on this day</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Click below to add a class, exam, or study slot.</p>
                  <Button onClick={() => openNew(selectedDay)} variant="outline" size="sm" className="mt-3 rounded-xl text-xs gap-1">
                    <Plus className="h-3.5 w-3.5" /> Create Event
                  </Button>
                </div>
              ) : (
                selectedDayEvents.map((e) => {
                  const cfg = TYPE_CONFIG[e.type] || TYPE_CONFIG.other;
                  const startTime = e.start_date ? format(parseISO(e.start_date), "h:mm a") : "";
                  const endTime = e.end_date ? format(parseISO(e.end_date), "h:mm a") : "";
                  const subj = e.subject_id ? subjectMap[e.subject_id] : null;

                  return (
                    <div
                      key={e.id}
                      onClick={() => openEdit(e)}
                      className="group relative flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 p-3 transition-all hover:border-primary/40 hover:bg-accent/30 cursor-pointer shadow-2xs"
                    >
                      <div className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", cfg.color)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{e.title}</h4>
                          <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider border", cfg.badge)}>
                            {cfg.label}
                          </span>
                        </div>

                        {startTime && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground font-mono">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>{startTime}{endTime ? ` - ${endTime}` : ""}</span>
                          </div>
                        )}

                        {subj && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <BookOpen className="h-3 w-3 shrink-0 text-primary/80" />
                            <span className="truncate">{subj.name}</span>
                          </div>
                        )}

                        {e.description && (
                          <p className="mt-1.5 text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                            {e.description}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={(ev) => remove(e, ev)}
                        className="rounded-lg p-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500/10 hover:text-rose-500"
                        title="Delete event"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={handleSaved}
        event={editing}
        subjects={subjects}
        presetDate={presetDate}
      />
    </div>
  );
}

import { format, formatDistanceToNow, isToday, isTomorrow, isPast, parseISO, differenceInCalendarDays } from "date-fns";

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  return parseISO(value);
}

export function formatDate(value, fmt = "MMM d, yyyy") {
  const d = toDate(value);
  if (!d) return "—";
  return format(d, fmt);
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "—";
  return format(d, "MMM d, yyyy · h:mm a");
}

export function formatTime(value) {
  const d = toDate(value);
  if (!d) return "—";
  return format(d, "h:mm a");
}

export function relativeDate(value) {
  const d = toDate(value);
  if (!d) return "—";
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  const diff = differenceInCalendarDays(d, new Date());
  if (diff === -1) return "Yesterday";
  if (diff > 0 && diff <= 7) return `In ${diff} days`;
  if (diff < 0 && diff >= -7) return `${Math.abs(diff)} days ago`;
  return format(d, "MMM d");
}

export function isOverdue(value) {
  const d = toDate(value);
  if (!d) return false;
  return isPast(d) && !isToday(d);
}

export function daysUntil(value) {
  const d = toDate(value);
  if (!d) return null;
  return differenceInCalendarDays(d, new Date());
}

export function dueLabel(value) {
  const d = toDate(value);
  if (!d) return null;
  const diff = differenceInCalendarDays(d, new Date());
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, tone: "overdue" };
  if (diff === 0) return { text: "Due today", tone: "today" };
  if (diff === 1) return { text: "Due tomorrow", tone: "soon" };
  if (diff <= 7) return { text: `Due in ${diff}d`, tone: "soon" };
  return { text: format(d, "MMM d"), tone: "normal" };
}
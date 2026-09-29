export function formatTimer(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function calculateStreak(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return 0;
  const days = new Set();
  sessions.forEach((s) => {
    if (s.started_at || s.created_at || s.created_date) {
      const dt = new Date(s.started_at || s.created_at || s.created_date);
      if (!isNaN(dt.getTime())) {
        days.add(dt.toDateString());
      }
    }
  });

  if (days.size === 0) return 0;

  let streak = 0;
  let date = new Date();
  if (!days.has(date.toDateString())) {
    date.setDate(date.getDate() - 1);
  }
  while (days.has(date.toDateString())) {
    streak++;
    date.setDate(date.getDate() - 1);
  }
  return Math.max(streak, days.size > 0 ? 1 : 0);
}

export function getTodayFocusSeconds(sessions) {
  if (!Array.isArray(sessions)) return 0;
  const today = new Date().toDateString();
  return sessions
    .filter((s) => {
      const dtStr = s.started_at || s.created_at || s.created_date;
      if (!dtStr) return false;
      return new Date(dtStr).toDateString() === today;
    })
    .reduce((sum, s) => {
      const duration = s.actual_duration_seconds || s.duration_seconds || s.duration || 0;
      return sum + Number(duration);
    }, 0);
}

export function getTodaySessionCount(sessions) {
  if (!Array.isArray(sessions)) return 0;
  const today = new Date().toDateString();
  return sessions.filter((s) => {
    const dtStr = s.started_at || s.created_at || s.created_date;
    if (!dtStr) return false;
    return new Date(dtStr).toDateString() === today;
  }).length;
}

export function getTotalFocusSeconds(sessions) {
  if (!Array.isArray(sessions)) return 0;
  return sessions.reduce((sum, s) => {
    const duration = s.actual_duration_seconds || s.duration_seconds || s.duration || 0;
    return sum + Number(duration);
  }, 0);
}

export function getFocusBySubject(sessions) {
  const map = {};
  sessions
    .filter((s) => s.status === "completed" && s.mode === "focus" && s.subject_id)
    .forEach((s) => {
      map[s.subject_id] = (map[s.subject_id] || 0) + (s.actual_duration_seconds || 0);
    });
  return map;
}
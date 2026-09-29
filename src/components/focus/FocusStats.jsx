import StatCard from "@/components/StatCard";
import { Clock, CheckCircle2, Flame, Timer } from "lucide-react";
import {
  formatDuration,
  calculateStreak,
  getTodayFocusSeconds,
  getTodaySessionCount,
  getTotalFocusSeconds,
} from "@/libs/focusUtils";

export default function FocusStats({ sessions }) {
  const todaySeconds = getTodayFocusSeconds(sessions);
  const todayCount = getTodaySessionCount(sessions);
  const streak = calculateStreak(sessions);
  const totalSeconds = getTotalFocusSeconds(sessions);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard icon={Clock} label="Today's focus" value={formatDuration(todaySeconds)} accent="primary" />
      <StatCard icon={CheckCircle2} label="Sessions today" value={todayCount} accent="emerald" />
      <StatCard icon={Flame} label="Day streak" value={streak} accent="amber" />
      <StatCard icon={Timer} label="Total focus" value={formatDuration(totalSeconds)} accent="blue" />
    </div>
  );
}
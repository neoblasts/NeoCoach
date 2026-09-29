// Maps subject color names to Tailwind class fragments.
// Classes are written as full literal strings so Tailwind's purge keeps them.
export const SUBJECT_COLORS = {
  indigo: { dot: "bg-indigo-500", text: "text-indigo-600 dark:text-indigo-400", soft: "bg-indigo-50 dark:bg-indigo-500/10", ring: "ring-indigo-200 dark:ring-indigo-500/30" },
  violet: { dot: "bg-violet-500", text: "text-violet-600 dark:text-violet-400", soft: "bg-violet-50 dark:bg-violet-500/10", ring: "ring-violet-200 dark:ring-violet-500/30" },
  blue: { dot: "bg-blue-500", text: "text-blue-600 dark:text-blue-400", soft: "bg-blue-50 dark:bg-blue-500/10", ring: "ring-blue-200 dark:ring-blue-500/30" },
  emerald: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", soft: "bg-emerald-50 dark:bg-emerald-500/10", ring: "ring-emerald-200 dark:ring-emerald-500/30" },
  amber: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", soft: "bg-amber-50 dark:bg-amber-500/10", ring: "ring-amber-200 dark:ring-amber-500/30" },
  rose: { dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", soft: "bg-rose-50 dark:bg-rose-500/10", ring: "ring-rose-200 dark:ring-rose-500/30" },
  cyan: { dot: "bg-cyan-500", text: "text-cyan-600 dark:text-cyan-400", soft: "bg-cyan-50 dark:bg-cyan-500/10", ring: "ring-cyan-200 dark:ring-cyan-500/30" },
  orange: { dot: "bg-orange-500", text: "text-orange-600 dark:text-orange-400", soft: "bg-orange-50 dark:bg-orange-500/10", ring: "ring-orange-200 dark:ring-orange-500/30" },
  pink: { dot: "bg-pink-500", text: "text-pink-600 dark:text-pink-400", soft: "bg-pink-50 dark:bg-pink-500/10", ring: "ring-pink-200 dark:ring-pink-500/30" },
  teal: { dot: "bg-teal-500", text: "text-teal-600 dark:text-teal-400", soft: "bg-teal-50 dark:bg-teal-500/10", ring: "ring-teal-200 dark:ring-teal-500/30" },
};

export function getColor(name) {
  return SUBJECT_COLORS[name] || SUBJECT_COLORS.indigo;
}
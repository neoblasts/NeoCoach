import { cn } from "@/libs/utils";

export default function StatCard({ icon: Icon, label, value, hint, accent = "primary" }) {
  const accents = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", accents[accent])}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        )}
      </div>
      <p className="mt-3 font-display text-3xl font-extrabold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
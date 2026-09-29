import { cn } from "@/libs/utils";

export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("lifeos-surface flex min-h-[360px] flex-col items-center justify-center rounded-lg px-6 py-14 text-center", className)}>
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground shadow-[0_18px_45px_rgba(0,0,0,0.20)]">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

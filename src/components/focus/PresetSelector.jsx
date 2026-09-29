import { Timer, Repeat, Clock, Coffee, MoonStar } from "lucide-react";
import { cn } from "@/libs/utils";

const PRESETS = [
  { value: "pomodoro", label: "Pomodoro", description: "25 / 5 / 15", icon: Repeat },
  { value: "custom_pomodoro", label: "Custom Pomodoro", description: "Your durations", icon: Timer },
  { value: "custom", label: "Custom Focus", description: "Single timer", icon: Clock },
  { value: "short_break", label: "Short Break", description: "Quick rest", icon: Coffee },
  { value: "long_break", label: "Long Break", description: "Longer rest", icon: MoonStar },
];

export default function PresetSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {PRESETS.map((p) => {
        const Icon = p.icon;
        const active = value === p.value;
        return (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all",
              active
                ? "border-primary/35 bg-primary/10 text-primary shadow-[0_10px_28px_rgba(32,199,201,0.12)]"
                : "border-border bg-secondary/45 text-muted-foreground hover:border-primary/30 hover:bg-accent/50"
            )}
          >
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg transition-colors", active ? "bg-primary/10" : "bg-muted")}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

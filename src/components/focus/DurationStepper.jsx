import { useState, useEffect } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/libs/utils";

export default function DurationStepper({ label, value, onChange, min = 1, max = 180, unit = "min", disabled }) {
  const [inputValue, setInputValue] = useState(String(value ?? ""));

  useEffect(() => {
    setInputValue(String(value ?? ""));
  }, [value]);

  const commitValue = (val) => {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
      setInputValue(String(clamped));
    } else {
      setInputValue(String(value));
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleBlur = () => {
    commitValue(inputValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      commitValue(inputValue);
      e.target.blur();
    }
  };

  const step = (delta) => {
    const next = Math.max(min, Math.min(max, Number(value || 0) + delta));
    onChange(next);
    setInputValue(String(next));
  };

  const isMinuteUnit = unit === "min";

  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border bg-card p-2.5", disabled && "opacity-50")}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground/90">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            disabled={disabled}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="h-6 w-12 rounded-md border border-border/80 bg-background/80 px-1 text-center font-mono text-xs font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label={`${label} input`}
          />
          {unit ? <span className="text-[11px] font-medium text-muted-foreground">{unit}</span> : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-1 pt-0.5">
        {/* Decrease Controls */}
        <div className="flex items-center gap-1">
          {isMinuteUnit && (
            <button
              type="button"
              onClick={() => step(-5)}
              disabled={disabled || value <= min}
              className="flex h-6 px-1.5 items-center justify-center rounded-md bg-muted text-[10px] font-bold transition-colors hover:bg-muted/70 disabled:opacity-30"
              title="Decrease by 5 minutes"
            >
              -5
            </button>
          )}
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={disabled || value <= min}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-muted transition-colors hover:bg-muted/70 disabled:opacity-30"
            title={`Decrease ${label} by 1`}
          >
            <Minus className="h-3 w-3" />
          </button>
        </div>

        {/* Quick Current Display */}
        <span className="text-[11px] font-mono font-bold text-primary tabular-nums">
          {value}{unit ? ` ${unit}` : ""}
        </span>

        {/* Increase Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(1)}
            disabled={disabled || value >= max}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-muted transition-colors hover:bg-muted/70 disabled:opacity-30"
            title={`Increase ${label} by 1`}
          >
            <Plus className="h-3 w-3" />
          </button>
          {isMinuteUnit && (
            <button
              type="button"
              onClick={() => step(5)}
              disabled={disabled || value >= max}
              className="flex h-6 px-1.5 items-center justify-center rounded-md bg-muted text-[10px] font-bold transition-colors hover:bg-muted/70 disabled:opacity-30"
              title="Increase by 5 minutes"
            >
              +5
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
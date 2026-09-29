import { useState, useRef, useEffect } from "react";
import {
  HelpCircle,
  Sparkles,
  GraduationCap,
  Code2,
  Brain,
  Terminal,
  UserCheck,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/libs/utils";

export default function DeveloperProfilePopover() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const timeoutRef = useRef(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const skills = [
    "Python",
    "LangChain",
    "Java",
    "Flutter",
    "React",
    "Electron",
  ];

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Help Icon Button */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="About Developer & Help"
        title="About Developer / Help"
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground transition-all duration-200",
          "hover:border-primary/40 hover:bg-accent hover:text-foreground hover:shadow-sm",
          open && "border-primary/50 bg-primary/10 text-primary shadow-[0_0_20px_rgba(32,199,201,0.18)]"
        )}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {/* Pop-out Hover Profile Card */}
      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full z-50 mt-2.5 w-[330px] sm:w-[360px] overflow-hidden rounded-2xl border border-border/70 bg-card/95 p-5 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-200 select-none"
        >
          {/* Header Profile Section */}
          <div className="flex items-center gap-3.5 border-b border-border/40 pb-4">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 via-primary/10 to-transparent border border-primary/30 text-primary font-bold text-base shadow-inner">
              <span>AK</span>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card text-[9px] text-white font-bold">
                ✓
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-extrabold tracking-tight text-foreground">
                  Anush Kushwaha
                </h3>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
                  Developer
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Class 12th PCM Science Student
              </p>
            </div>
          </div>

          {/* Developer Bio & Details */}
          <div className="py-3.5 space-y-3 border-b border-border/40">
            <div className="flex items-start gap-2.5 text-xs text-foreground/90 leading-relaxed">
              <Brain className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
              <p>
                Main developer of <span className="font-semibold text-foreground">NeoCoach</span> and an aspiring <span className="font-semibold text-primary">AI/ML & Software Engineer</span>.
              </p>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
              <Code2 className="h-4 w-4 shrink-0 text-purple-500 mt-0.5" />
              <p>
                Currently building hands-on projects with Python, Java, and Flutter, with specialized experience in AI frameworks like LangChain.
              </p>
            </div>
          </div>

          {/* Skills & Experience Tags */}
          <div className="pt-3 pb-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              <Terminal className="h-3.5 w-3.5 text-primary" />
              <span>Tech Stack & Experience</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Footer Banner */}
          <div className="mt-3.5 flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1 font-medium">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Built for NeoCoach
            </span>
            <span className="font-medium text-foreground/80">Anush Kushwaha</span>
          </div>
        </div>
      )}
    </div>
  );
}


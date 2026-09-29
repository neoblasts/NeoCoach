import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ListTodo,
  BookOpen,
  ClipboardList,
  CalendarDays,
  Timer,
  Sparkles,
  Layers,
  HelpCircle,
  ShieldCheck,
  Cpu,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "@/libs/utils";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/",            label: "Dashboard",        icon: LayoutDashboard, end: true, section: "Home" },
  { to: "/subjects",    label: "Subjects & Graph", icon: BookOpen,        section: "Learn" },
  { to: "/learn",       label: "Flashcards & Quiz", icon: Layers,          section: "Learn" },
  { to: "/study-coach", label: "AI Assistant & Coach", icon: Sparkles, section: "Learn" },
  { to: "/focus",       label: "Focus Timer",      icon: Timer,           section: "Focus" },
  { to: "/focus-guard", label: "Focus Guard",      icon: ShieldCheck,     section: "Focus" },
  { to: "/tasks",       label: "Tasks",            icon: ListTodo,        section: "Plan" },
  { to: "/assignments", label: "Assignments",      icon: ClipboardList,   section: "Plan" },
  { to: "/calendar",    label: "Calendar",         icon: CalendarDays,    section: "Plan" },
  { to: "/ai-management", label: "AI & Tokens",    icon: Cpu,             section: "System" },
];

export default function Sidebar({ open, onClose }) {
  const location = useLocation();
  const navigate  = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    onClose?.();
    await logout();
    navigate("/login", { replace: true });
  };

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "U";

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[14px_0_50px_rgba(0,0,0,0.18)] transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-[76px] items-center justify-between px-5 border-b border-sidebar-border/60">
          <Link to="/" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/35 bg-primary/80 text-primary-foreground shadow-[0_8px_24px_rgba(32,199,201,0.20)]">
              <span className="font-display text-lg font-extrabold">N</span>
            </div>
            <div className="leading-tight">
              <p className="font-display text-base font-extrabold text-foreground tracking-tight">NeoCoach</p>
              <p className="text-[11px] text-muted-foreground font-medium">Personal Study OS</p>
            </div>
          </Link>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 space-y-4 px-3 py-3 overflow-y-auto scrollbar-thin">
          {["Home", "Learn", "Focus", "Plan", "System"].map((section) => (
            <div key={section}>
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-primary/65">{section}</p>
              <div className="space-y-0.5">
                {NAV.filter((item) => item.section === section).map((item) => {
                  const active = item.end
                    ? location.pathname === item.to
                    : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary" />}
                      <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-sidebar-foreground/60")} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Profile Footer */}
        <div className="border-t border-sidebar-border p-3 bg-sidebar/80">
          <Link
            to="/profile"
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{user?.displayName || "Student"}</p>
              <p className="truncate text-[10px] text-muted-foreground">{user?.email || "Settings & Profile"}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

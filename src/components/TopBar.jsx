import { useEffect, useState } from "react";
import { Menu, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import DeveloperProfilePopover from "@/components/DeveloperProfilePopover";
import ThemeToggle from "@/components/ThemeToggle";
import { localClient } from "@/api/localStorageClient";

export default function TopBar({ onMenuClick }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    setProfile(localClient.profile.get());
  }, []);

  const initials = (profile?.full_name || profile?.email || "U").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between gap-3 border-b border-border bg-background/88 px-4 shadow-[0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-md lg:px-9">
      <button
        onClick={onMenuClick}
        className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Link to="/tasks" className="hidden sm:block">
          <Button size="sm" className="h-10 gap-1.5 rounded-lg px-4">
            <Plus className="h-4 w-4" /> Quick Add
          </Button>
        </Link>
        <DeveloperProfilePopover />
        <ThemeToggle />
        <Link to="/profile" aria-label="Profile">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/25 bg-primary/20 text-sm font-semibold text-primary shadow-[0_0_30px_rgba(32,199,201,0.14)] transition-colors hover:bg-primary/30">
            {initials}
          </div>
        </Link>
      </div>
    </header>
  );
}

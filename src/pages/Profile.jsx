import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import AISettings from "@/components/AISettings";
import { localClient } from "@/api/localStorageClient";
import { User, Download, Upload, Trash2, Brain, Moon, Sun, LogOut, KeyRound } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { user, logout, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState("");
  const [resetSending, setResetSending] = useState(false);

  useEffect(() => {
    const p = localClient.profile.get();
    setProfile(p);
    // Pre-fill from Firebase displayName if local profile name is blank
    setFullName(p?.full_name || user?.displayName || "");
  }, [user]);

  const handleSaveName = () => {
    const updated = localClient.profile.update({ full_name: fullName });
    setProfile(updated);
    toast({ title: "Profile updated" });
  };

  const handleSendReset = async () => {
    const targetEmail = user?.email || profile?.email;
    if (!targetEmail) {
      toast({ title: "No email address found", variant: "destructive" });
      return;
    }
    setResetSending(true);
    try {
      await resetPassword(targetEmail);
      toast({ title: "Password Reset Email Sent!", description: `Check inbox for ${targetEmail}` });
    } catch (err) {
      toast({ title: "Failed to send reset email", description: err.message, variant: "destructive" });
    } finally {
      setResetSending(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleExportData = () => {
    const data = {};
    ["Task", "Subject", "Assignment", "CalendarEvent", "FocusSession",
     "LearningCard", "LearningEvent", "Note", "Topic", "TopicMastery", "User"
    ].forEach(entity => {
      const raw = localStorage.getItem(`lifeos_${entity}`);
      if (raw) data[entity] = JSON.parse(raw);
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifeos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Data exported", description: "Your backup file has been downloaded." });
  };

  const handleImportData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        Object.keys(data).forEach(entity => {
          localStorage.setItem(`lifeos_${entity}`, JSON.stringify(data[entity]));
        });
        toast({ title: "Data imported", description: "Reloading app..." });
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        toast({ title: "Import failed", description: "Invalid backup file.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = () => {
    if (!confirm("This will permanently delete ALL your data (tasks, subjects, cards, etc.). This cannot be undone. Are you sure?")) return;
    localClient.clearAll();
    toast({ title: "All data cleared", description: "Reloading..." });
    setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profile & Settings" subtitle="Manage your account, AI configuration, and data." />

      <div className="space-y-6">
        {/* Account */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-bold">Account</h3>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block">Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="h-10" />
            </div>
            <div>
              <Label className="mb-1.5 block">Email</Label>
              <p className="text-sm text-muted-foreground">{user?.email || profile?.email || "Not set"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button onClick={handleSaveName} size="sm" className="rounded-full">Save name</Button>
              <Button onClick={handleSendReset} disabled={resetSending} variant="outline" size="sm" className="gap-1.5 rounded-full">
                <KeyRound className="h-3.5 w-3.5" /> {resetSending ? "Sending link..." : "Reset Password"}
              </Button>
              <Button onClick={handleLogout} variant="outline" size="sm" className="gap-1.5 rounded-full text-rose-500 hover:border-rose-500/40 hover:bg-rose-500/10">
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </Button>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
            <h3 className="font-display text-lg font-bold">Appearance</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Toggle between light and dark themes</p>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
          </div>
        </div>

        {/* AI Settings */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <AISettings />
        </div>

        {/* Data Management */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-bold">Data Management</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            All your data is stored locally on this device. Export a backup or import from a previous backup.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExportData} variant="outline" size="sm" className="rounded-full gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export backup
            </Button>
            <label>
              <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
              <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-input bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">
                <Upload className="h-3.5 w-3.5" /> Import backup
              </span>
            </label>
            <Button onClick={handleClearData} variant="outline" size="sm" className="rounded-full gap-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10">
              <Trash2 className="h-3.5 w-3.5" /> Clear all data
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

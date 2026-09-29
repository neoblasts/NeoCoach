import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

export default function Signup() {
  const { signup } = useAuth();
  const navigate   = useNavigate();

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const friendlyError = (code) => {
    switch (code) {
      case "auth/email-already-in-use": return "An account with this email already exists.";
      case "auth/weak-password":        return "Password must be at least 6 characters.";
      case "auth/invalid-email":        return "Please enter a valid email address.";
      case "auth/network-request-failed": return "Network error. Check your connection.";
      default: return "Could not create account. Please try again.";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }
    setError("");
    setLoading(true);
    try {
      await signup(email.trim(), password, name.trim());
      navigate("/", { replace: true });
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center gap-6 bg-gradient-to-br from-primary/10 via-background to-violet-500/10 px-16 border-r border-border">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Brain className="h-8 w-8" />
        </div>
        <div className="text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">NeoCoach</h1>
          <p className="mt-2 text-lg text-muted-foreground">Start your study journey today</p>
        </div>
        <div className="mt-4 rounded-2xl border bg-card/60 p-5 text-sm text-muted-foreground max-w-xs space-y-2">
          <p className="font-semibold text-foreground">Free forever on Spark plan</p>
          <p>Your data stays on your device. AI features use your own API keys — no hidden costs.</p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Brain className="h-6 w-6" />
          </div>
          <span className="font-display text-2xl font-extrabold">NeoCoach</span>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold">Create your account</h2>
            <p className="mt-1 text-sm text-muted-foreground">Set up NeoCoach in under a minute</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Your name" autoComplete="name" required className="h-11" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" autoComplete="email" required className="h-11" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPwd ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters"
                  autoComplete="new-password" required className="h-11 pr-10" />
                <button type="button" onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type={showPwd ? "text" : "password"} value={confirm}
                onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password"
                autoComplete="new-password" required className="h-11" />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <Button type="submit" className="h-11 w-full rounded-xl text-sm font-semibold" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

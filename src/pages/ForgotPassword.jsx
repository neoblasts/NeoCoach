import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [sent,    setSent]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      if (err.code === "auth/user-not-found") setError("No account found with that email.");
      else setError("Failed to send reset email. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Brain className="h-6 w-6" />
          </div>
          <span className="font-display text-2xl font-extrabold">NeoCoach</span>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <h2 className="mb-1 font-display text-xl font-bold">Reset password</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Enter your email and we'll send you a reset link.
          </p>

          {sent ? (
            <div className="flex flex-col items-center gap-3 text-center py-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="font-semibold">Check your inbox</p>
              <p className="text-sm text-muted-foreground">
                A password reset link was sent to <strong>{email}</strong>
              </p>
              <Link to="/login" className="mt-2 text-sm font-medium text-primary hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" required className="h-11" />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

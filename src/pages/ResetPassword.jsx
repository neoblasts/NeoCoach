import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, Loader2, AlertCircle, CheckCircle2, LockKeyhole } from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { confirmResetPassword, verifyResetCode } = useAuth();

  const oobCode = searchParams.get("oobCode") || searchParams.get("code") || "";
  const mode = searchParams.get("mode") || "resetPassword";

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifying, setVerifying] = useState(Boolean(oobCode));
  const [codeValid, setCodeValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function checkCode() {
      if (!oobCode) {
        setVerifying(false);
        return;
      }
      try {
        const userEmail = await verifyResetCode(oobCode);
        setEmail(userEmail || "");
        setCodeValid(true);
      } catch (err) {
        console.error("Invalid reset code:", err);
        setError("This password reset link is invalid or has expired.");
        setCodeValid(false);
      } finally {
        setVerifying(false);
      }
    }
    checkCode();
  }, [oobCode, verifyResetCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await confirmResetPassword(oobCode, newPassword);
      setSuccess(true);
    } catch (err) {
      console.error("Password reset error:", err);
      if (err.code === "auth/invalid-action-code") {
        setError("This reset code is invalid or has expired. Please request a new link.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError(err.message || "Failed to reset password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Brain className="h-6 w-6" />
          </div>
          <span className="font-display text-2xl font-extrabold tracking-tight">NeoCoach</span>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <LockKeyhole className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold">Set new password</h2>
          </div>

          {verifying ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verifying password reset code...</p>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="text-lg font-bold">Password Reset Complete!</p>
              <p className="text-sm text-muted-foreground mb-4">
                Your password has been updated successfully. You can now log in with your new password.
              </p>
              <Button onClick={() => navigate("/login")} className="w-full rounded-xl">
                Sign in to NeoCoach
              </Button>
            </div>
          ) : !oobCode || !codeValid ? (
            <div className="space-y-4 text-center py-2">
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{error || "No password reset code found in URL."}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Please click the link in your email or request a new reset link.
              </p>
              <Button onClick={() => navigate("/forgot-password")} variant="outline" className="w-full rounded-xl">
                Request new reset link
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {email && (
                <p className="text-xs text-muted-foreground">
                  Resetting password for <strong className="text-foreground">{email}</strong>
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  className="h-11"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save New Password"}
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

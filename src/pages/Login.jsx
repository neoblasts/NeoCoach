import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/libs/utils";
import { Brain, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

const REMEMBER_KEY = "lifeos-remembered-login";

// Lightweight AES-GCM encryption so the saved login isn't sitting in
// localStorage as plain text. The key is derived (PBKDF2) from a fixed
// app-level passphrase + a random per-record salt. Note: since this all
// runs in the renderer, the key material is technically derivable from
// the app's own source — this stops casual DevTools/localStorage
// snooping, but it is NOT the same guarantee as OS-keychain-backed
// storage (Electron's `safeStorage` API, used via the main process).
const APP_PASSPHRASE = "lifeos-local-login-v1";

async function deriveKey(salt) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(APP_PASSPHRASE),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function toBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function encryptCredentials(data) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(data))
  );
  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(ciphertext),
  };
}

async function decryptCredentials(payload) {
  const salt = fromBase64(payload.salt);
  const iv = fromBase64(payload.iv);
  const key = await deriveKey(salt);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    fromBase64(payload.data)
  );
  return JSON.parse(new TextDecoder().decode(plainBuf));
}

export default function Login() {
  const { login } = useAuth();
  const navigate   = useNavigate();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // Prefill from a previously saved (encrypted) login, if any.
  useEffect(() => {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return;
    (async () => {
      try {
        const payload = JSON.parse(raw);
        const saved = await decryptCredentials(payload);
        if (saved?.email) {
          setEmail(saved.email);
          setPassword(saved.password || "");
          setRememberMe(true);
        }
      } catch {
        // Corrupted or undecryptable entry — drop it instead of leaving junk behind.
        localStorage.removeItem(REMEMBER_KEY);
      }
    })();
  }, []);

  const friendlyError = (code) => {
    switch (code) {
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential": return "Invalid email or password.";
      case "auth/too-many-requests":  return "Too many attempts. Try again later.";
      case "auth/network-request-failed": return "Network error. Check your connection.";
      default: return "Something went wrong. Please try again.";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);

      if (rememberMe) {
        const encrypted = await encryptCredentials({ email: email.trim(), password });
        localStorage.setItem(REMEMBER_KEY, JSON.stringify(encrypted));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      navigate("/", { replace: true });
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const forgetSavedLogin = () => {
    localStorage.removeItem(REMEMBER_KEY);
    setRememberMe(false);
    setEmail("");
    setPassword("");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center gap-6 bg-gradient-to-br from-primary/10 via-background to-violet-500/10 px-16 border-r border-border">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Brain className="h-8 w-8" />
        </div>
        <div className="text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground">NeoCoach</h1>
          <p className="mt-2 text-lg text-muted-foreground">Your personal study operating system</p>
        </div>
        <div className="mt-6 grid gap-3 text-sm text-muted-foreground max-w-xs">
          {[
            "AI-powered Study Coach",
            "Smart assignment tracking",
            "Focus sessions & Pomodoro",
            "Adaptive learning cards",
            "Calendar & deadline management",
          ].map((f) => (
            <div key={f} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Brain className="h-6 w-6" />
          </div>
          <span className="font-display text-2xl font-extrabold">NeoCoach</span>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to continue to your workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="remember-me" className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Remember me
              </label>

              {rememberMe && (
                <button
                  type="button"
                  onClick={forgetSavedLogin}
                  className="text-xs text-muted-foreground hover:text-rose-500 hover:underline"
                >
                  Forget saved login
                </button>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="h-11 w-full rounded-xl text-sm font-semibold" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

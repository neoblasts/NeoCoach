/**
 * ProtectedRoute — redirects unauthenticated users to /login.
 * If authenticated but no AI key configured, redirects to /setup.
 */
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getAISettings } from "@/libs/aiProviders";
import { Loader2 } from "lucide-react";

const REQUIRED_PROVIDERS = ["gemini", "groq"];

export default function ProtectedRoute({ children, skipKeyCheck = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  const [checking,    setChecking]    = useState(true);
  const [hasKey,      setHasKey]      = useState(false);

  useEffect(() => {
    if (loading || !user) { setChecking(false); return; }
    if (skipKeyCheck)     { setChecking(false); setHasKey(true); return; }
    getAISettings().then((s) => {
      // Both required providers must have a key configured
      const allKeys = REQUIRED_PROVIDERS.every((p) => s.keys?.[p]);
      setHasKey(allKeys);
      setChecking(false);
    });
  }, [loading, user, skipKeyCheck]);

  // Still loading Firebase auth state
  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in but no AI key — gate to setup page
  // (except if already on /setup)
  if (!hasKey && location.pathname !== "/setup") {
    return <Navigate to="/setup" replace />;
  }

  return children;
}

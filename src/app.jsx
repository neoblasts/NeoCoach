import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/libs/query-client";
import { HashRouter as Router, Route, Routes } from "react-router-dom";
import PageNotFound from "./libs/PageNotFound";
import ScrollToTop from "./components/ScrollToTop";
import ThemeProvider from "@/components/ThemeProvider";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { FocusProvider } from "@/context/FocusContext";
import { AuthProvider } from "@/context/AuthContext";

// Auth pages
import Login          from "@/pages/Login";
import Signup         from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword  from "@/pages/ResetPassword";
import ApiKeySetup    from "@/pages/ApiKeySetup";

// App pages
import Dashboard    from "@/pages/Dashboard";
import Tasks        from "@/pages/Tasks";
import Subjects     from "@/pages/Subjects";
import Assignments  from "@/pages/Assignments";
import Calendar     from "@/pages/Calendar";
import Focus        from "@/pages/Focus";
import FocusGuard   from "@/pages/FocusGuard";
import Learn        from "@/pages/Learn";
import StudyCoach   from "@/pages/StudyCoach";
import AIManagement from "@/pages/AIManagement";
import Profile      from "@/pages/Profile";

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClientInstance}>
        <AuthProvider>
          <FocusProvider>
            <Router>
              <ScrollToTop />
              <Routes>
                {/* ── Public auth routes ── */}
                <Route path="/login"           element={<Login />} />
                <Route path="/signup"          element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password"  element={<ResetPassword />} />
                <Route path="/__/auth/action"  element={<ResetPassword />} />

                {/* ── API key setup gate (authenticated but no key yet) ── */}
                <Route
                  path="/setup"
                  element={
                    <ProtectedRoute skipKeyCheck>
                      <ApiKeySetup />
                    </ProtectedRoute>
                  }
                />

                {/* ── Main app (protected + requires key) ── */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/"              element={<Dashboard />} />
                  <Route path="/tasks"         element={<Tasks />} />
                  <Route path="/subjects"      element={<Subjects />} />
                  <Route path="/assignments"   element={<Assignments />} />
                  <Route path="/calendar"      element={<Calendar />} />
                  <Route path="/focus"         element={<Focus />} />
                  <Route path="/focus-guard"   element={<FocusGuard />} />
                  <Route path="/learn"         element={<Learn />} />
                  <Route path="/study-coach"   element={<StudyCoach />} />
                  <Route path="/ai-management" element={<AIManagement />} />
                  <Route path="/profile"       element={<Profile />} />
                </Route>

                <Route path="*" element={<PageNotFound />} />
              </Routes>
            </Router>
          </FocusProvider>
        </AuthProvider>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

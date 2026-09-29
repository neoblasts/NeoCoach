/**
 * Global Focus timer context.
 *
 * Focus Guard is owned by Electron's main process. The renderer treats the
 * main-process status as authoritative and never invents an "active" state.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { localClient } from "@/api/localStorageClient";
import { useFocusEngine } from "@/hooks/useFocusEngine";
import { getFocusSettings, saveFocusSettings } from "@/libs/focusStorage";
import { requestNotificationPermission } from "@/libs/focusNotifications";
import { formatTimer } from "@/libs/focusUtils";

const FocusContext = createContext(null);

export function FocusProvider({ children }) {
  const [settings, setSettings] = useState(getFocusSettings);
  const [lastSession, setLastSession] = useState(null);
  const [reloadSignal, setReloadSignal] = useState(0);
  const [startError, setStartError] = useState("");
  const [guardActive, setGuardActiveState] = useState(false);
  const [guardStatus, setGuardStatus] = useState(null);

  const guardExpectedRef = useRef(false);
  const guardRecoveryInFlightRef = useRef(false);
  const guardFailureStreakRef = useRef(0);
  const guardStopPromiseRef = useRef(null);

  const updateSettings = useCallback((next) => {
    setSettings(next);
    saveFocusSettings(next);
  }, []);

  const handleSessionEnd = useCallback(async (sessionData) => {
    try {
      await localClient.entities.FocusSession.create(sessionData);
      setReloadSignal((n) => n + 1);
    } catch (error) {
      console.warn("[Focus] session persistence failed:", error?.message || error);
    }
  }, []);

  const engine = useFocusEngine({ settings, onSessionEnd: handleSessionEnd });
  const engineStartRef = useRef(engine.start);
  const engineStopRef = useRef(engine.stop);
  engineStartRef.current = engine.start;
  engineStopRef.current = engine.stop;

  const setGuardState = useCallback((value) => {
    setGuardActiveState(Boolean(value));
  }, []);

  const refreshGuardStatus = useCallback(async () => {
    const api = window.electronAPI?.focusGuard;
    if (!api?.status) return null;
    try {
      const status = await api.status();
      setGuardStatus(status || null);
      setGuardActiveState(Boolean(status?.active));
      return status || null;
    } catch (error) {
      console.warn("[Focus] Guard status check failed:", error?.message || error);
      return null;
    }
  }, []);

  // Poll guard status in main process to keep UI status updated.
  // CRITICAL REQUIREMENT: The focus timer MUST NOT be stopped by transient guard status
  // drops or background worker hiccups. The timer is owned by the user and must run its full
  // duration (e.g. 25 minutes). If the guard status drops to inactive, attempt silent
  // background auto-reactivation without touching or stopping the user's running timer.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const status = await refreshGuardStatus();
      if (cancelled || !status) return;

      if (engine.active && guardExpectedRef.current) {
        if (status.active) {
          guardFailureStreakRef.current = 0;
        } else {
          guardFailureStreakRef.current += 1;
          // Every 10 seconds of inactive status while timer is running, attempt silent auto-reactivation
          if (guardFailureStreakRef.current % 5 === 0 && !guardRecoveryInFlightRef.current) {
            guardRecoveryInFlightRef.current = true;
            console.warn("[Focus] Focus Guard inactive during focus session — attempting silent auto-reactivation...");
            try {
              await window.electronAPI?.focusGuard?.activate?.();
            } catch (err) {
              console.error("[Focus] Silent guard auto-reactivation error:", err?.message || err);
            } finally {
              guardRecoveryInFlightRef.current = false;
              refreshGuardStatus();
            }
          }
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [engine.active, refreshGuardStatus]);

  // The guard remains active through Pomodoro focus/break phases. It only
  // ends after the complete timer lifecycle ends.
  const previousEngineActiveRef = useRef(engine.active);
  useEffect(() => {
    const wasActive = previousEngineActiveRef.current;
    previousEngineActiveRef.current = engine.active;
    if (wasActive && !engine.active && guardExpectedRef.current && !guardStopPromiseRef.current) {
      // Timer reached its natural end.
      stopGuardForReason("session_ended_automatically");
    }
  }, [engine.active]);

  useEffect(() => {
    document.title = engine.active
      ? `${formatTimer(engine.remaining)} · ${engine.phase === "focus" ? "Focus" : "Break"} — NeoCoach`
      : "NeoCoach — Your personal operating system";
  }, [engine.active, engine.remaining, engine.phase]);

  const stopGuardForReason = useCallback(async (reason) => {
    if (guardStopPromiseRef.current) return guardStopPromiseRef.current;
    const api = window.electronAPI?.focusGuard;
    if (!api?.deactivate) {
      guardExpectedRef.current = false;
      setGuardState(false);
      return { ok: true, active: false };
    }

    guardStopPromiseRef.current = (async () => {
      try {
        const result = await api.deactivate({ reason });
        if (result?.ok && result?.active === false) {
          guardExpectedRef.current = false;
          setGuardState(false);
          setGuardStatus((previous) => ({ ...(previous || {}), ...(result || {}), active: false, lifecycle: "VERIFIED_NORMAL" }));
        } else {
          setStartError(result?.error || "Focus Guard could not be stopped safely.");
        }
        return result;
      } catch (error) {
        const result = { ok: false, active: true, error: error?.message || "Focus Guard could not be stopped safely." };
        setStartError(result.error);
        return result;
      } finally {
        guardStopPromiseRef.current = null;
        await refreshGuardStatus();
      }
    })();

    return guardStopPromiseRef.current;
  }, [refreshGuardStatus, setGuardState]);

  const startSession = useCallback(async (config) => {
    setStartError("");
    guardFailureStreakRef.current = 0;

    if (settings.notificationsEnabled) requestNotificationPermission();

    const api = window.electronAPI?.focusGuard;
    if (api) {
      try {
        const before = await api.status();
        let result = before?.active ? { ok: true, active: true, alreadyActive: true } : await api.activate();

        if (result?.relaunching) {
          setStartError("NeoCoach is restarting with Administrator privileges. Start the study timer again in the elevated NeoCoach window.");
          return false;
        }
        if (!result?.ok || result?.active === false) {
          setStartError(result?.error || "Focus Guard could not be activated safely.");
          return false;
        }

        const verified = await api.status();
        setGuardStatus(verified || null);
        if (!verified?.active) {
          setStartError("Focus Guard did not pass its live-enforcement health check, so the timer was not started.");
          try { await api.emergencyRestore?.(); } catch {}
          await refreshGuardStatus();
          return false;
        }

        guardExpectedRef.current = true;
        setGuardState(true);
      } catch (error) {
        setStartError(error?.message || "Focus Guard could not be activated safely.");
        return false;
      }
    }

    setLastSession({
      topicId: config.topicId || null,
      subjectId: config.subjectId || null,
      label: config.label || "",
    });
    engineStartRef.current(config);
    return true;
  }, [refreshGuardStatus, setGuardState, settings.notificationsEnabled]);

  const stopSession = useCallback(async () => {
    engineStopRef.current();
    return stopGuardForReason("user_stopped_session");
  }, [stopGuardForReason]);

  const deactivateGuard = useCallback(async ({ pin = "", reason = "manual" } = {}) => {
    try {
      const result = await window.electronAPI?.focusGuard?.deactivate?.({ pin, reason });
      if (result?.ok && result?.active === false) {
        guardExpectedRef.current = false;
        engineStopRef.current();
        setGuardState(false);
        setGuardStatus((previous) => ({ ...(previous || {}), ...(result || {}), active: false }));
        setStartError("");
      } else {
        setStartError(result?.error || "Focus Guard could not be stopped safely.");
      }
      await refreshGuardStatus();
      return result;
    } catch (error) {
      const result = { ok: false, active: true, error: error?.message || "Focus Guard could not be stopped safely." };
      setStartError(result.error);
      return result;
    }
  }, [refreshGuardStatus, setGuardState]);

  const emergencyRestore = useCallback(async () => {
    try {
      const result = await window.electronAPI?.focusGuard?.emergencyRestore?.();
      if (result?.ok && result?.active === false) {
        guardExpectedRef.current = false;
        engineStopRef.current();
        setGuardState(false);
        setStartError("");
      } else {
        setStartError(result?.error || "Emergency Focus Guard restore could not be verified.");
      }
      await refreshGuardStatus();
      return result;
    } catch (error) {
      const result = { ok: false, active: true, emergency: true, error: error?.message || "Emergency restore failed." };
      setStartError(result.error);
      return result;
    }
  }, [refreshGuardStatus, setGuardState]);

  return (
    <FocusContext.Provider value={{
      engine,
      settings,
      updateSettings,
      startSession,
      stopSession,
      deactivateGuard,
      emergencyRestore,
      refreshGuardStatus,
      startError,
      guardActive,
      guardStatus,
      setGuardActive: setGuardState,
      lastSession,
      reloadSignal,
    }}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocusContext() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error("useFocusContext must be used inside <FocusProvider>");
  return ctx;
}

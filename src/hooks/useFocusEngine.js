import { useState, useRef, useEffect, useCallback } from "react";
import { playStartSound, playEndSound, playBreakSound } from "@/libs/focusSounds";
import { sendNotification } from "@/libs/focusNotifications";

/**
 * Manages the Focus Mode timer state machine.
 * Handles focus/break phases, Pomodoro cycles, pause/resume/stop/skip/restart,
 * and calls onSessionEnd with session data for persistence.
 */
export function useFocusEngine({ settings, onSessionEnd }) {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState("focus");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const [round, setRound] = useState(1);
  const [cycleCount, setCycleCount] = useState(0);
  const [flow, setFlow] = useState("single");
  const [sessionMeta, setSessionMeta] = useState(null);
  const [completed, setCompleted] = useState(false);

  // Refs for values accessed in interval callbacks
  const endTimeRef = useRef(0);
  const pausedRemainingRef = useRef(0);
  const phaseRef = useRef("focus");
  const roundRef = useRef(1);
  const cycleCountRef = useRef(0);
  const flowRef = useRef("single");
  const metaRef = useRef(null);
  const settingsRef = useRef(settings);
  const onSessionEndRef = useRef(onSessionEnd);
  const remainingRef = useRef(0);
  const totalRef = useRef(0);
  const activeRef = useRef(false);
  const runningRef = useRef(false);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { onSessionEndRef.current = onSessionEnd; }, [onSessionEnd]);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { runningRef.current = running; }, [running]);

  const phaseDuration = useCallback((ph) => {
    const s = settingsRef.current;
    if (ph === "focus") return (s.focusDuration || 25) * 60;
    if (ph === "short_break") return (s.shortBreak || 5) * 60;
    if (ph === "long_break") return (s.longBreak || 15) * 60;
    return 0;
  }, []);

  const persistSession = useCallback((status, actualSeconds) => {
    const meta = metaRef.current;
    if (!meta) return;
    onSessionEndRef.current?.({
      mode: meta.phase,
      session_type: meta.sessionType,
      label: meta.label,
      planned_duration_seconds: meta.plannedDuration,
      actual_duration_seconds: Math.round(actualSeconds),
      status,
      subject_id: meta.subjectId || undefined,
      assignment_id: meta.assignmentId || undefined,
      task_id: meta.taskId || undefined,
      topic_id: meta.topicId || undefined,
      started_at: meta.startedAt,
      ended_at: new Date().toISOString(),
      pomodoro_round: meta.round,
    });
  }, []);

  const lastReminderMinuteRef = useRef(0);

  const notifyPhaseStart = useCallback((ph, durationSeconds) => {
    const mins = Math.max(1, Math.round(durationSeconds / 60));
    if (ph === "focus") {
      sendNotification("Focus Timer ON ⏱️", `Focus timer for ${mins} minute${mins !== 1 ? "s" : ""} is now active as commanded.`);
    } else {
      sendNotification("Break Timer Started ☕", `Break timer has started for ${mins} minute${mins !== 1 ? "s" : ""}. Take a rest!`);
    }
  }, []);

  const beginPhase = useCallback((ph, rdy, cyc, autoStart) => {
    const duration = phaseDuration(ph);
    phaseRef.current = ph;
    roundRef.current = rdy;
    cycleCountRef.current = cyc;
    totalRef.current = duration;
    remainingRef.current = duration;
    lastReminderMinuteRef.current = 0;
    setPhase(ph);
    setRound(rdy);
    setCycleCount(cyc);
    setTotal(duration);
    setRemaining(duration);

    metaRef.current = {
      ...metaRef.current,
      phase: ph,
      plannedDuration: duration,
      startedAt: new Date().toISOString(),
      round: rdy,
    };

    if (autoStart) {
      setRunning(true);
      endTimeRef.current = Date.now() + duration * 1000;
      if (settingsRef.current.soundEnabled) playStartSound();
      notifyPhaseStart(ph, duration);
    } else {
      setRunning(false);
      pausedRemainingRef.current = duration;
    }
  }, [phaseDuration, notifyPhaseStart]);

  const transition = useCallback(() => {
    const s = settingsRef.current;
    const meta = metaRef.current;
    const fl = flowRef.current;

    if (!meta || fl === "single") {
      setActive(false);
      setRunning(false);
      metaRef.current = null;
      setSessionMeta(null);
      return;
    }

    if (meta.phase === "focus") {
      const newCyc = cycleCountRef.current + 1;
      const nextPhase = newCyc >= s.sessionsBeforeLongBreak ? "long_break" : "short_break";
      const resetCyc = newCyc >= s.sessionsBeforeLongBreak ? 0 : newCyc;
      beginPhase(nextPhase, roundRef.current, resetCyc, s.autoStartBreaks);
    } else {
      beginPhase("focus", roundRef.current + 1, cycleCountRef.current, s.autoStartNext);
    }
  }, [beginPhase]);

  // Timer tick & Periodic Reminders
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const rem = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      remainingRef.current = rem;
      setRemaining(rem);

      // Check periodic reminder interval
      const s = settingsRef.current;
      if (s.notificationsEnabled && phaseRef.current === "focus") {
        const elapsedSec = totalRef.current - rem;
        const elapsedMin = Math.floor(elapsedSec / 60);
        const interval = Math.max(1, s.reminderIntervalMinutes || 10);
        if (elapsedMin > 0 && elapsedMin % interval === 0 && lastReminderMinuteRef.current !== elapsedMin) {
          lastReminderMinuteRef.current = elapsedMin;
          sendNotification("Focus Reminder 🔔", `Focus session in progress (${elapsedMin} minute${elapsedMin !== 1 ? "s" : ""} elapsed). Keep going!`);
        }
      }

      if (rem <= 0) {
        setRunning(false);
        setCompleted(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Handle phase completion
  useEffect(() => {
    if (!completed) return;
    setCompleted(false);

    const meta = metaRef.current;
    const s = settingsRef.current;
    const planned = meta?.plannedDuration || 0;
    persistSession("completed", planned);

    if (meta?.phase === "focus") {
      if (s.soundEnabled) playEndSound();
      sendNotification("Focus Session Ended 🎉", "Focus timer finished! Time for a break.");
    } else {
      if (s.soundEnabled) playBreakSound();
      sendNotification("Break Timer Ended 🔔", "Break time is over! Ready to focus again?");
    }
    transition();
  }, [completed, persistSession, transition]);

  // Unmount cleanup — persist interrupted session
  useEffect(() => {
    return () => {
      if (activeRef.current && runningRef.current) {
        const meta = metaRef.current;
        if (meta && meta.phase === "focus") {
          const elapsed = meta.plannedDuration - remainingRef.current;
          if (elapsed > 5) persistSession("interrupted", elapsed);
        }
      }
    };
  }, [persistSession]);

  const start = useCallback((config) => {
    const isCycle = config.preset === "pomodoro" || config.preset === "custom_pomodoro";
    flowRef.current = isCycle ? "cycle" : "single";
    setFlow(isCycle ? "cycle" : "single");

    let initialPhase = "focus";
    if (config.preset === "short_break") initialPhase = "short_break";
    if (config.preset === "long_break") initialPhase = "long_break";

    const metaObj = {
      label: config.label || "",
      subjectId: config.subjectId || "",
      assignmentId: config.assignmentId || "",
      taskId: config.taskId || "",
      topicId: config.topicId || "",
      sessionType: config.sessionType || "study",
      phase: initialPhase,
      plannedDuration: 0,
      startedAt: new Date().toISOString(),
      round: 1,
    };
    metaRef.current = metaObj;
    setSessionMeta(metaObj);

    setActive(true);
    beginPhase(initialPhase, 1, 0, true);
  }, [beginPhase]);

  const pause = useCallback(() => {
    setRunning(false);
    pausedRemainingRef.current = remainingRef.current;
    sendNotification("Focus Timer Paused ⏸️", "Focus timer is currently paused.");
  }, []);

  const resume = useCallback(() => {
    setRunning(true);
    endTimeRef.current = Date.now() + pausedRemainingRef.current * 1000;
    sendNotification("Focus Timer ON ⏱️", "Focus timer has been resumed.");
  }, []);

  const stop = useCallback(() => {
    const meta = metaRef.current;
    if (meta && meta.phase === "focus") {
      const elapsed = meta.plannedDuration - remainingRef.current;
      if (elapsed > 5) persistSession("interrupted", elapsed);
    }
    setRunning(false);
    setActive(false);
    metaRef.current = null;
    setSessionMeta(null);
    sendNotification("Focus Timer OFF 🛑", "Focus timer has been turned off.");
  }, [persistSession]);

  const skip = useCallback(() => {
    const meta = metaRef.current;
    if (meta && meta.phase === "focus") {
      const elapsed = meta.plannedDuration - remainingRef.current;
      if (elapsed > 5) persistSession("interrupted", elapsed);
    }
    transition();
  }, [persistSession, transition]);

  const restart = useCallback(() => {
    const duration = totalRef.current;
    remainingRef.current = duration;
    setRemaining(duration);
    setRunning(true);
    endTimeRef.current = Date.now() + duration * 1000;
  }, []);

  return {
    active, phase, running, remaining, total, round, cycleCount,
    flow, sessionMeta,
    start, pause, resume, stop, skip, restart,
  };
}
const KEY = "lifeos_focus_settings_v1";

export const DEFAULT_FOCUS_SETTINGS = {
  focusDuration: 25,
  shortBreak: 5,
  longBreak: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreaks: true,
  autoStartNext: false,
  soundEnabled: true,
  notificationsEnabled: false,
};

export function getFocusSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_FOCUS_SETTINGS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_FOCUS_SETTINGS };
    return { ...DEFAULT_FOCUS_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_FOCUS_SETTINGS };
  }
}

export function saveFocusSettings(settings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage not available
  }
}
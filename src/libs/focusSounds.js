let audioCtx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function tone(freq, duration, type = "sine", volume = 0.2, delay = 0) {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  } catch {
    // Audio not available
  }
}

export function playStartSound() {
  tone(523.25, 0.15, "sine", 0.15);
  tone(659.25, 0.2, "sine", 0.15, 0.12);
}

export function playEndSound() {
  tone(523.25, 0.12, "sine", 0.2);
  tone(659.25, 0.12, "sine", 0.2, 0.1);
  tone(783.99, 0.35, "sine", 0.2, 0.2);
}

export function playBreakSound() {
  tone(440, 0.15, "sine", 0.15);
  tone(523.25, 0.2, "sine", 0.15, 0.12);
}
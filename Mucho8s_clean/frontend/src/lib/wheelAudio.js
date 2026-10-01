let audioContext = null;
let masterGain = null;

const STORAGE_KEY = "mucho8s-wheel-sound";
const activeTimers = new Set();

const readEnabled = () => {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
};

let soundEnabled = readEnabled();

const getContext = () => {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!audioContext) {
    audioContext = new AudioCtx();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.72;
    masterGain.connect(audioContext.destination);
  }

  return audioContext;
};

export const isWheelSoundEnabled = () => soundEnabled;

export const setWheelSoundEnabled = (enabled) => {
  soundEnabled = Boolean(enabled);
  try {
    window.localStorage.setItem(STORAGE_KEY, soundEnabled ? "on" : "off");
  } catch {}

  if (soundEnabled) unlockWheelAudio();
  else stopWheelSpinSfx();

  return soundEnabled;
};

export const unlockWheelAudio = async () => {
  if (!soundEnabled) return false;
  const ctx = getContext();
  if (!ctx) return false;

  try {
    if (ctx.state === "suspended") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
};

const click = (strength = 1, pitch = 980) => {
  if (!soundEnabled) return;
  const ctx = getContext();
  if (!ctx || ctx.state !== "running" || !masterGain) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = "square";
  osc.frequency.setValueAtTime(pitch, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(180, pitch * 0.42), now + 0.024);

  filter.type = "highpass";
  filter.frequency.value = 420;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.035 * strength, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  osc.start(now);
  osc.stop(now + 0.035);
};

export const playWheelLand = () => {
  if (!soundEnabled) return;
  const ctx = getContext();
  if (!ctx || ctx.state !== "running" || !masterGain) return;

  click(1.25, 760);

  const now = ctx.currentTime;
  const notes = [
    { frequency: 659.25, start: 0.035, duration: 0.16, gain: 0.038 },
    { frequency: 880, start: 0.11, duration: 0.21, gain: 0.045 },
    { frequency: 1174.66, start: 0.2, duration: 0.27, gain: 0.032 },
  ];

  notes.forEach((note) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(note.frequency, now + note.start);
    gain.gain.setValueAtTime(0.0001, now + note.start);
    gain.gain.exponentialRampToValueAtTime(note.gain, now + note.start + 0.018);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + note.start + note.duration
    );
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now + note.start);
    osc.stop(now + note.start + note.duration + 0.02);
  });
};

export const playWheelDrop = () => {
  if (!soundEnabled) return;
  const ctx = getContext();
  if (!ctx || ctx.state !== "running" || !masterGain) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(86, now + 0.095);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.12);
};

export const stopWheelSpinSfx = () => {
  activeTimers.forEach((timer) => window.clearTimeout(timer));
  activeTimers.clear();
};

export const startWheelSpinSfx = (duration = 3200) => {
  stopWheelSpinSfx();
  if (!soundEnabled || typeof window === "undefined") return () => {};

  let cancelled = false;

  unlockWheelAudio().then((ready) => {
    if (!ready || cancelled || !soundEnabled) return;

    let elapsed = 20;
    let index = 0;

    while (elapsed < duration - 145) {
      const progress = Math.min(1, elapsed / duration);
      const interval =
        34 +
        Math.pow(progress, 2.25) * 225 +
        Math.sin(index * 0.9) * 4;

      const timer = window.setTimeout(() => {
        activeTimers.delete(timer);
        if (!cancelled && soundEnabled) {
          const pitch = 1080 - progress * 370 + (index % 3) * 24;
          click(0.72 + progress * 0.34, pitch);
        }
      }, elapsed);

      activeTimers.add(timer);
      elapsed += Math.max(28, interval);
      index += 1;
    }
  });

  return () => {
    cancelled = true;
    stopWheelSpinSfx();
  };
};

// Browsers block programmatic audio until a user gesture. One interaction anywhere
// on the page primes the shared wheel audio context for live spectator spins.
if (typeof window !== "undefined") {
  const prime = () => {
    unlockWheelAudio();
    window.removeEventListener("pointerdown", prime, true);
    window.removeEventListener("keydown", prime, true);
  };
  window.addEventListener("pointerdown", prime, true);
  window.addEventListener("keydown", prime, true);
}

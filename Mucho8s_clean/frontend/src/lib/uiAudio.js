let ctx = null;
let master = null;

const STORAGE_KEY = "mucho8s-ui-sound";
let enabled = true;

try {
  enabled = window.localStorage.getItem(STORAGE_KEY) !== "off";
} catch {}

const getContext = () => {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!ctx) {
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.58;
    master.connect(ctx.destination);
  }
  return ctx;
};

export const isUiSoundEnabled = () => enabled;

export const setUiSoundEnabled = (value) => {
  enabled = Boolean(value);
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {}
  if (enabled) void unlockUiAudio();
  return enabled;
};

export const unlockUiAudio = async () => {
  if (!enabled) return false;
  const audio = getContext();
  if (!audio) return false;
  try {
    if (audio.state === "suspended") await audio.resume();
    return audio.state === "running";
  } catch {
    return false;
  }
};

const tone = ({
  frequency = 520,
  frequencyEnd = null,
  type = "sine",
  gain = 0.025,
  start = 0,
  duration = 0.055,
}) => {
  if (!enabled) return;
  const audio = getContext();
  if (!audio || audio.state !== "running" || !master) return;

  const at = audio.currentTime + start;
  const osc = audio.createOscillator();
  const amp = audio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  if (frequencyEnd) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, frequencyEnd),
      at + duration
    );
  }

  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  osc.connect(amp);
  amp.connect(master);
  osc.start(at);
  osc.stop(at + duration + 0.02);
};

const noiseTick = ({ gain = 0.018, start = 0, duration = 0.025 } = {}) => {
  if (!enabled) return;
  const audio = getContext();
  if (!audio || audio.state !== "running" || !master) return;

  const length = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }

  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const amp = audio.createGain();
  const at = audio.currentTime + start;

  filter.type = "highpass";
  filter.frequency.value = 1400;
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(amp);
  amp.connect(master);
  source.start(at);
};

const palettes = {
  mucho8s: {
    click: [260, 390],
    select: [320, 480],
    back: [300, 210],
    next: [360, 540],
    confirm: [360, 540, 720],
  },
  mucho1v1: {
    click: [520, 690],
    select: [560, 840],
    back: [520, 390],
    next: [620, 930],
    confirm: [660, 990, 1320],
    money: [880, 1320],
  },
  tourney: {
    click: [440, 660],
    select: [520, 780],
    back: [520, 390],
    next: [590, 885],
    confirm: [523.25, 659.25, 783.99],
  },
  switcheroo: {
    click: [620, 930],
    select: [700, 1050],
    back: [620, 465],
    next: [740, 1110],
    confirm: [659.25, 987.77, 1318.51],
  },
};

export const playUiSound = async (kind = "click", product = "tourney") => {
  if (!enabled) return;
  const ready = await unlockUiAudio();
  if (!ready) return;

  const palette = palettes[product] || palettes.tourney;
  const notes = palette[kind] || palette.click;

  if (kind === "click") {
    noiseTick({ gain: 0.013 });
    tone({
      frequency: notes[0],
      frequencyEnd: notes[1],
      type: product === "mucho8s" ? "square" : "triangle",
      gain: 0.018,
      duration: 0.035,
    });
    return;
  }

  if (kind === "back") {
    tone({
      frequency: notes[0],
      frequencyEnd: notes[1],
      type: "triangle",
      gain: 0.022,
      duration: 0.075,
    });
    return;
  }

  if (kind === "money") {
    tone({ frequency: notes[0], type: "sine", gain: 0.024, duration: 0.09 });
    tone({ frequency: notes[1], type: "sine", gain: 0.022, start: 0.055, duration: 0.11 });
    return;
  }

  notes.forEach((frequency, index) => {
    tone({
      frequency,
      type: product === "mucho8s" ? "triangle" : "sine",
      gain: kind === "confirm" ? 0.027 : 0.021,
      start: index * (kind === "confirm" ? 0.055 : 0.035),
      duration: kind === "confirm" ? 0.13 : 0.07,
    });
  });

  if (kind === "confirm" && product === "tourney") {
    noiseTick({ gain: 0.01, start: 0.025, duration: 0.035 });
  }
};

if (typeof window !== "undefined") {
  const prime = () => {
    void unlockUiAudio();
    window.removeEventListener("pointerdown", prime, true);
    window.removeEventListener("keydown", prime, true);
  };
  window.addEventListener("pointerdown", prime, true);
  window.addEventListener("keydown", prime, true);
}

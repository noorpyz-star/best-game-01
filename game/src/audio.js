// LUMEN DRIFT — procedural sound. Every effect is synthesized with WebAudio
// oscillators and noise; there are no audio files. The context starts suspended
// until the first player gesture and every call is guarded, so the game plays
// silently (never crashes) in a headless browser or with sound off.

let ctx = null;
let master = null;
let muted = false;
let musicTimer = null;
let musicStep = 0;

// A quiet minor-key drift: one soft pad note per bar, plus a slow pulse.
const MUSIC_NOTES = [110.0, 130.81, 98.0, 146.83, 110.0, 164.81, 98.0, 130.81];
const MUSIC_BAR_MS = 1500;

function ensureContext() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

export function unlockAudio() {
  const c = ensureContext();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = muted ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

function tone(freq, dur, type, vol, slideTo) {
  if (muted) return;
  const c = ensureContext();
  if (!c || c.state !== 'running') return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), c.currentTime + dur);
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(c.currentTime + dur + 0.02);
  } catch {
    // Sound is garnish; never let it break the game.
  }
}

function noiseBurst(dur, vol, lowFreq) {
  if (muted) return;
  const c = ensureContext();
  if (!c || c.state !== 'running') return;
  try {
    const len = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowFreq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  } catch {
    // Ignore audio failures.
  }
}

/** Laser: a quick square blip sliding down. */
export function playZap() {
  tone(880, 0.09, 'square', 0.12, 220);
}

/** Asteroid breaking apart: filtered noise thump. */
export function playBoom(size) {
  noiseBurst(0.28, 0.35, size === 'big' ? 900 : 1600);
  tone(90, 0.22, 'sine', 0.3, 40);
}

/** Salvage pickup: a chime that climbs with the combo multiplier. */
export function playChime(combo) {
  const base = 520 * (1 + 0.12 * (combo - 1));
  tone(base, 0.12, 'sine', 0.2);
  tone(base * 1.5, 0.16, 'sine', 0.14);
}

/** Hull hit: a harsh low buzz plus noise. */
export function playHit() {
  tone(160, 0.25, 'sawtooth', 0.3, 55);
  noiseBurst(0.2, 0.3, 700);
}

/** Power-up: a rising three-note arpeggio. */
export function playPowerup() {
  tone(392, 0.1, 'triangle', 0.22);
  setTimeout(() => tone(523.25, 0.1, 'triangle', 0.22), 90);
  setTimeout(() => tone(659.25, 0.18, 'triangle', 0.22), 180);
}

/** Level up: a short bright fanfare. */
export function playLevelUp() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((n, i) => setTimeout(() => tone(n, 0.22, 'triangle', 0.2), i * 110));
}

/** Seeker inbound: two quiet warning blips. */
export function playWarn() {
  tone(220, 0.12, 'sine', 0.14);
  setTimeout(() => tone(165, 0.16, 'sine', 0.14), 130);
}

/** Dash: a soft whoosh. */
export function playDash() {
  noiseBurst(0.16, 0.16, 2400);
}

export function startMusic() {
  if (musicTimer !== null) return;
  musicTimer = setInterval(() => {
    if (muted) return;
    const c = ensureContext();
    if (!c || c.state !== 'running') return;
    const note = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
    musicStep += 1;
    tone(note, 1.2, 'sine', 0.05);
    tone(note * 2, 0.9, 'sine', 0.025);
  }, MUSIC_BAR_MS);
}

export function stopMusic() {
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

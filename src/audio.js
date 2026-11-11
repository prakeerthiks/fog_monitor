// Tiny WebAudio sound kit: no audio files needed.
let ctx = null;
let master = null;
let muted = false;
let ambientStarted = false;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(ctx.destination);
  startAmbient();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.8;
}
export const isMuted = () => muted;

function noiseBuffer(seconds = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02; // brown-ish noise
    d[i] = last * 3.5;
  }
  return buf;
}

function startAmbient() {
  if (ambientStarted) return;
  ambientStarted = true;
  // Underwater rumble
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(4);
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const g = ctx.createGain();
  g.gain.value = 0.12;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 140;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start();
  src.connect(lp).connect(g).connect(master);
  src.start();

  // Soft random pentatonic plinks, like a calm music box
  const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
  const plink = () => {
    if (ctx.state === 'running') {
      tone(scale[Math.floor(Math.random() * scale.length)], 0.9, 0.035, 'sine');
    }
    setTimeout(plink, 1800 + Math.random() * 3200);
  };
  setTimeout(plink, 1500);
}

function tone(freq, dur, vol, type = 'sine', slideTo = null) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function sfxBubble() {
  const f = 500 + Math.random() * 500;
  tone(f, 0.12, 0.09, 'sine', f * 1.8);
}

export function sfxWhoosh() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(1);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(1600, t + 0.5);
  bp.frequency.exponentialRampToValueAtTime(400, t + 1.1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 1.3);
}

export function sfxChime() {
  [659.25, 880, 1318.5].forEach((f, i) => setTimeout(() => tone(f, 0.5, 0.08, 'triangle'), i * 90));
}

export function sfxSwipe() {
  tone(300, 0.15, 0.08, 'triangle', 600);
}

// Soft marimba-like notes that wander up and down a pentatonic scale (sounds like a little melody)
const TYPE_SCALE = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
let typeIdx = 2;
export function sfxBlip() {
  if (!ctx) return;
  const r = Math.random();
  typeIdx += r < 0.4 ? 1 : r < 0.75 ? -1 : r < 0.9 ? 2 : -2;
  typeIdx = Math.max(0, Math.min(TYPE_SCALE.length - 1, typeIdx));
  const f = TYPE_SCALE[typeIdx];
  tone(f, 0.38, 0.05, 'sine');
  tone(f * 2, 0.18, 0.012, 'sine');
}

export function sfxCorrect() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => tone(f, 0.5, 0.09, 'triangle'), i * 110));
}

export function sfxWrong() {
  tone(330, 0.35, 0.07, 'sine', 247);
  setTimeout(() => tone(247, 0.4, 0.06, 'sine', 196), 180);
}

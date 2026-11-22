/** Small synthesized sound effects (story 7.4): no audio files to ship. */
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem('cinecards.muted') === '1';
  } catch {
    return false;
  }
})();

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('cinecards.muted', m ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/**
 * Story 13.12: creating the AudioContext takes a while; it is made on the first touch or key (when the browser
 * allows it), so the first played action does not pay for it in the middle of its animation.
 */
export function warmAudio() {
  if (typeof window === 'undefined') return;
  const warm = () => {
    if (!muted) ac();
    window.removeEventListener('pointerdown', warm, true);
    window.removeEventListener('keydown', warm, true);
  };
  window.addEventListener('pointerdown', warm, true);
  window.addEventListener('keydown', warm, true);
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.12, slide = 0, delay = 0) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain = 0.1, filter = 1200, delay = 0) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filter;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t0);
}

const SOUNDS: Record<string, () => void> = {
  play: () => noise(0.18, 0.08, 2500),
  draw: () => noise(0.09, 0.05, 5000),
  spell: () => {
    tone(660, 0.25, 'triangle', 0.08, 400);
    tone(990, 0.3, 'sine', 0.05, 300, 0.05);
  },
  swing: () => noise(0.12, 0.07, 4000),
  hit: () => {
    tone(140, 0.18, 'square', 0.06, -80);
    noise(0.08, 0.08, 900);
  },
  heroHit: () => {
    tone(90, 0.35, 'sawtooth', 0.08, -40);
    noise(0.2, 0.1, 600);
  },
  heal: () => {
    tone(523, 0.2, 'sine', 0.07);
    tone(784, 0.3, 'sine', 0.06, 0, 0.08);
  },
  buff: () => tone(440, 0.18, 'triangle', 0.06, 220),
  debuff: () => tone(330, 0.2, 'triangle', 0.06, -150),
  status: () => tone(880, 0.12, 'sine', 0.05, -200),
  death: () => {
    tone(300, 0.5, 'sawtooth', 0.06, -250);
    noise(0.3, 0.06, 700, 0.05);
  },
  dice: () => {
    for (let i = 0; i < 6; i++) noise(0.03, 0.08, 3000, i * 0.09);
  },
  coin: () => {
    tone(1318, 0.08, 'square', 0.03);
    tone(1760, 0.12, 'square', 0.03, 0, 0.06);
  },
  turn: () => tone(392, 0.5, 'sine', 0.06),
  legend: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.5, 'triangle', 0.07, 0, i * 0.1)),
  end: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.7, 'sine', 0.07, 0, i * 0.15)),
  error: () => tone(180, 0.15, 'square', 0.05),
  click: () => tone(1200, 0.03, 'square', 0.02),
};

export function sfx(name: string | undefined) {
  if (!name || muted) return;
  try {
    SOUNDS[name]?.();
  } catch {
    /* audio unavailable */
  }
}

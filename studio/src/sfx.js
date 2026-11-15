'use strict';
/* KK Verse Studio · sound design.
 * Every sound is synthesised here from maths (noise, sines, filters), so the studio ships with
 * no audio files and nothing to license. Sounds are deterministic: same edit → same audio. */

const SR = 48000;
const TAU = Math.PI * 2;

function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const buf = (sec) => new Float32Array(Math.max(1, Math.round(sec * SR)));
const expo = (a, b, u) => a * Math.pow(b / a, u);

/** State-variable band-pass over noise with a moving centre frequency. */
function sweptNoise(out, seed, fcAt, q, ampAt) {
  const r = rng(seed); let low = 0, band = 0;
  for (let i = 0; i < out.length; i++) {
    const u = i / out.length;
    const f = 2 * Math.sin(Math.PI * Math.min(fcAt(u), 7600) / SR);
    const x = r() * 2 - 1;
    low += f * band; const high = x - low - q * band; band += f * high;
    out[i] += band * ampAt(u);
  }
  return out;
}
function tone(out, fAt, ampAt, start = 0, shape = Math.sin) {
  let ph = 0; const s0 = Math.round(start * SR);
  for (let i = s0; i < out.length; i++) {
    const t = (i - s0) / SR;
    ph += (TAU * fAt(t)) / SR;
    out[i] += shape(ph) * ampAt(t);
  }
  return out;
}
function burst(out, seed, start, len, amp, lp = 1) {
  const r = rng(seed); let y = 0; const s0 = Math.round(start * SR), n = Math.round(len * SR);
  for (let i = 0; i < n && s0 + i < out.length; i++) { const x = (r() * 2 - 1) * Math.exp((-5 * i) / n); y += lp * (x - y); out[s0 + i] += y * amp; }
  return out;
}
const bell = (out, f0, start, gain = 1) => {
  [[1, 1, 5.5], [2.76, 0.42, 8], [5.4, 0.2, 13], [8.93, 0.08, 18]].forEach(([m, a, d]) => tone(out, () => f0 * m, (t) => gain * a * Math.exp(-t * d), start));
  return out;
};
function click(out, start, seed, amp = 1, f = 2200) {
  burst(out, seed, start, 0.004, 0.9 * amp, 0.7);
  const s0 = Math.round(start * SR);
  for (let i = 0; i < 0.04 * SR && s0 + i < out.length; i++) { const t = i / SR; out[s0 + i] += Math.sin(TAU * f * t) * Math.exp(-t * 230) * 0.6 * amp; }
  return out;
}

const SOUNDS = {
  whoosh: { desc: 'Airy pass-by for zooms and titles.', make: (o) => sweptNoise(buf(o.dur || 0.5), 11, (u) => 300 + 2500 * Math.pow(Math.sin(Math.PI * u), 2), 0.9, (u) => Math.pow(Math.sin(Math.PI * u), 1.7)) },
  swish: { desc: 'Short, light swipe for cards sliding in.', make: (o) => sweptNoise(buf(o.dur || 0.24), 23, (u) => expo(1100, 5200, u), 0.8, (u) => Math.pow(Math.sin(Math.PI * u), 2)) },
  pop: { desc: 'Soft bubble pop for words, ticks and likes.', make: () => { const b = buf(0.12); tone(b, (t) => 150 + 520 * Math.exp(-t * 55), (t) => Math.exp(-t * 36)); return burst(b, 5, 0, 0.003, 0.25, 0.6); } },
  click: { desc: 'Crisp UI click / button press.', make: () => click(buf(0.06), 0, 7) },
  tick: { desc: 'Tiny tick, e.g. a single key press.', make: () => click(buf(0.03), 0, 9, 0.7, 3400) },
  typing: { desc: 'A run of key taps. Give it a dur.', make: (o) => { const d = o.dur || 0.8, b = buf(d + 0.05), r = rng(31); let t = 0, k = 0; while (t < d) { click(b, t, 100 + k++, 0.55 + r() * 0.45, 2600 + r() * 1600); t += 0.055 + r() * 0.06; } return b; } },
  ding: { desc: 'Bright bell for a reveal or a final number.', make: () => bell(buf(0.9), 1320, 0) },
  success: { desc: 'Two-note chime: done, correct, following.', make: () => { const b = buf(1.0); bell(b, 1046.5, 0, 0.8); return bell(b, 1568, 0.1, 0.9); } },
  thud: { desc: 'Heavy impact for stamps and big words.', make: () => { const b = buf(0.4); tone(b, (t) => 44 + 120 * Math.exp(-t * 16), (t) => Math.exp(-t * 12)); return burst(b, 13, 0, 0.03, 0.7, 0.25); } },
  boom: { desc: 'Deep cinematic hit, long tail.', make: () => { const b = buf(1.1); tone(b, (t) => 32 + 60 * Math.exp(-t * 6), (t) => Math.exp(-t * 3.6)); return burst(b, 17, 0, 0.05, 0.5, 0.12); } },
  riser: { desc: 'Tension build into a reveal. Give it a dur.', make: (o) => { const d = o.dur || 1, b = buf(d); sweptNoise(b, 41, (u) => expo(400, 5200, u), 0.7, (u) => u * u * Math.min(1, (1 - u) * 40)); let ph = 0; for (let i = 0; i < b.length; i++) { const u = i / b.length; ph += (TAU * expo(220, 1760, u)) / SR; b[i] += Math.sin(ph) * 0.22 * Math.pow(u, 1.5) * Math.min(1, (1 - u) * 40); } return b; } },
  error: { desc: 'Two-pulse buzzer: wrong, myth, nope.', make: () => { const b = buf(0.3); let y = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; const on = t < 0.09 || (t > 0.14 && t < 0.27); const x = on ? (Math.sin(TAU * 150 * t) > 0 ? 1 : -1) : 0; y += 0.18 * (x - y); b[i] = y * 0.8; } return b; } },
  shutter: { desc: 'Camera shutter for a freeze or screenshot.', make: () => { const b = buf(0.16); burst(b, 3, 0, 0.018, 0.9, 0.8); burst(b, 4, 0.07, 0.03, 0.8, 0.5); return click(b, 0.07, 6, 0.5, 1500); } },
  sparkle: { desc: 'Glittery run of high notes.', make: () => { const b = buf(0.6), r = rng(77); for (let k = 0; k < 8; k++) { const f = 2600 + k * 420 + r() * 300; tone(b, () => f, (t) => 0.5 * Math.exp(-t * 34), k * 0.045); } return b; } },
  scribble: { desc: 'Marker on paper, for arrows and doodles.', make: (o) => sweptNoise(buf(o.dur || 0.45), 53, (u) => 2300 + 500 * Math.sin(u * 40), 0.9, (u) => Math.pow(Math.abs(Math.sin(u * Math.PI * 4.5)), 0.6) * Math.sin(Math.PI * u)) },
};

function make(name, opts = {}) {
  const def = SOUNDS[name];
  if (!def) return null;
  const b = def.make(opts);
  let peak = 0; for (let i = 0; i < b.length; i++) peak = Math.max(peak, Math.abs(b[i]));
  const g = peak > 0 ? 0.89 / peak : 1;
  const fade = Math.min(b.length, Math.round(0.004 * SR));
  for (let i = 0; i < b.length; i++) b[i] *= g;
  for (let i = 0; i < fade; i++) b[b.length - 1 - i] *= i / fade; // no end click
  return b;
}

/** events: [{ name, at (seconds, relative to track start), gain (dB), dur? }] → mono float track */
function mix(events, duration) {
  const out = new Float32Array(Math.max(1, Math.ceil(duration * SR)));
  let used = 0;
  for (const ev of events) {
    const b = make(ev.name, ev);
    if (!b) continue;
    const g = Math.pow(10, (ev.gain == null ? -10 : ev.gain) / 20);
    const s0 = Math.round(ev.at * SR);
    for (let i = Math.max(0, -s0); i < b.length && s0 + i < out.length; i++) out[s0 + i] += b[i] * g;
    used++;
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i]); // gentle safety limiter
  return { samples: out, used };
}

function wav(samples) {
  const n = samples.length, data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
    data.writeInt16LE(v, 44 + i * 4); data.writeInt16LE(v, 46 + i * 4);
  }
  return data;
}

module.exports = { SOUNDS, make, mix, wav, SR };

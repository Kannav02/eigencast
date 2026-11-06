/**
 * Synthesizes the launch video's 30-second music bed and writes launch/assets/music.wav.
 * Everything is generated here from oscillators and seeded noise, so there are no samples
 * or licensed sounds. The arrangement follows the video's cuts:
 *
 *   0.0–2.7 s   the prompt is typed: a quiet A-minor drone and keystrokes, rising into
 *   2.7–5.0 s   the title: an impact and two bells
 *   5.0–17.0 s  Claude Code works: kick, bass, 16th-note arpeggio over Am–F–C–G
 *   17.0–25.1 s the finished video plays: pads only, kept low under its narration
 *   25.1–30 s   end card: a C-major swell and bells, fading out
 *
 * Run: bun launch/music.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SR = 44100;
const DUR = 30;
const N = SR * DUR;
const OUT = join(import.meta.dir, "assets", "music.wav");

const dry = [new Float32Array(N), new Float32Array(N)];
const send = [new Float32Array(N), new Float32Array(N)]; // reverb bus

/** Seeded random numbers in [0, 1) (mulberry32), so the track is identical on every run. */
function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const noise = rng(7);
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Mix a mono voice into the track at `t0` seconds with gain, pan (-1..1) and reverb send. */
function mix(voice: Float32Array, t0: number, gain: number, pan = 0, verb = 0.2) {
  const s0 = Math.round(t0 * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < voice.length; i++) {
    const j = s0 + i;
    if (j < 0 || j >= N) continue;
    dry[0][j] += voice[i] * gl;
    dry[1][j] += voice[i] * gr;
    send[0][j] += voice[i] * gl * verb;
    send[1][j] += voice[i] * gr * verb;
  }
}

/** One-pole low-pass, in place. `cutoff` may change per sample. */
function lowpass(x: Float32Array, cutoff: (i: number) => number) {
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    const a = 1 - Math.exp((-2 * Math.PI * cutoff(i)) / SR);
    y += a * (x[i] - y);
    x[i] = y;
  }
  return x;
}

const saw = (p: number) => 2 * (p - Math.floor(p + 0.5));
const tri = (p: number) => 1 - 4 * Math.abs(p - Math.floor(p + 0.5));

function kick(t0: number, gain = 0.9) {
  const n = Math.round(0.4 * SR);
  const v = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (44 + 90 * Math.exp(-t * 28)) / SR;
    v[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 7.5) + (t < 0.004 ? (noise() - 0.5) * 0.6 : 0);
  }
  mix(v, t0, gain, 0, 0.05);
}

function hat(t0: number, gain = 0.12, pan = 0.25) {
  const n = Math.round(0.07 * SR);
  const v = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const x = noise() * 2 - 1;
    lp += 0.35 * (x - lp);
    v[i] = (x - lp) * Math.exp((-i / SR) * 70);
  }
  mix(v, t0, gain, pan, 0.15);
}

function bass(t0: number, dur: number, note: number, gain = 0.32) {
  const n = Math.round(dur * SR);
  const v = new Float32Array(n);
  const f = hz(note);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.006) * Math.min(1, (dur - t) / 0.03);
    v[i] = (0.6 * saw(f * t) + 0.5 * Math.sin(2 * Math.PI * f * t)) * env;
  }
  mix(lowpass(v, () => 420), t0, gain, 0, 0.02);
}

function pluck(t0: number, note: number, gain = 0.16, pan = 0) {
  const n = Math.round(0.6 * SR);
  const v = new Float32Array(n);
  const f = hz(note);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    v[i] = (0.7 * tri(f * t) + 0.3 * saw(f * t)) * Math.exp(-t * 7) * Math.min(1, t / 0.002);
  }
  mix(lowpass(v, (i) => 600 + 3200 * Math.exp((-i / SR) * 9)), t0, gain, pan, 0.35);
}

function pad(t0: number, dur: number, notes: number[], gain = 0.07, attack = 0.5, release = 0.9) {
  const n = Math.round((dur + release) * SR);
  const v = new Float32Array(n);
  for (const note of notes) {
    for (const cents of [-8, 0, 7]) {
      const f = hz(note) * 2 ** (cents / 1200);
      const off = noise();
      for (let i = 0; i < n; i++) v[i] += saw(f * (i / SR) + off);
    }
  }
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / attack) * (t > dur ? Math.max(0, 1 - (t - dur) / release) : 1);
    v[i] *= env / notes.length;
  }
  const left = lowpass(Float32Array.from(v), () => 1100);
  const right = lowpass(v, () => 1000);
  mix(left, t0, gain, -0.5, 0.5);
  mix(right, t0, gain, 0.5, 0.5);
}

function riser(t0: number, t1: number, gain = 0.22) {
  const n = Math.round((t1 - t0) * SR);
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = (noise() * 2 - 1) * (i / n) ** 2.2;
  mix(lowpass(v, (i) => 200 * 40 ** (i / n)), t0, gain, 0, 0.4);
}

function bell(t0: number, note: number, gain = 0.16, pan = 0) {
  const n = Math.round(3.5 * SR);
  const v = new Float32Array(n);
  const f = hz(note);
  const partials: [number, number, number][] = [[1, 1, 1.4], [2.76, 0.45, 2.4], [5.4, 0.22, 3.6], [8.93, 0.1, 5]];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    for (const [m, a, d] of partials) s += a * Math.sin(2 * Math.PI * f * m * t) * Math.exp(-t * d);
    v[i] = s * Math.min(1, t / 0.003);
  }
  mix(v, t0, gain, pan, 0.6);
}

function impact(t0: number, gain = 1) {
  kick(t0, 0.95 * gain);
  const n = Math.round(1.6 * SR);
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = (noise() * 2 - 1) * Math.exp((-i / SR) * 3.2);
  mix(lowpass(v, (i) => 5000 * Math.exp((-i / SR) * 2) + 300), t0, 0.16 * gain, 0, 0.8);
}

// ---------- arrangement ----------
const CHORDS: Record<string, { root: number; tones: number[] }> = {
  Am: { root: 45, tones: [57, 60, 64] },
  F: { root: 41, tones: [53, 57, 60] },
  C: { root: 48, tones: [55, 60, 64] },
  G: { root: 43, tones: [55, 59, 62] },
};

// 0–2.7 s: the prompt is typed
pad(0, 5.0, [45, 57, 64], 0.06, 1.0, 0.6);
const keys = rng(11);
for (let t = 0.6; t < 2.35; t += 0.07 + keys() * 0.06) hat(t, 0.035 + keys() * 0.03, keys() - 0.5); // keystrokes
pluck(0.3, 76, 0.08, 0.3);
pluck(1.3, 72, 0.08, -0.3);
riser(1.7, 2.7, 0.18);
// 2.7–5 s: title
impact(2.7, 0.85);
bell(2.7, 81, 0.11, -0.2);
bell(3.2, 76, 0.08, 0.25);
riser(4.0, 5.0, 0.16);
// 5–17 s: Claude Code works
impact(5.0, 0.6);
const groove = ["Am", "F", "C", "G", "Am", "F"];
groove.forEach((name, bar) => {
  const t0 = 5 + bar * 2;
  const end = Math.min(t0 + 2, 17);
  const c = CHORDS[name];
  pad(t0, end - t0, c.tones, 0.055, 0.15, 0.4);
  for (let t = t0; t < end - 1e-6; t += 0.5) kick(t, t === 5 ? 0 : 0.75);
  for (let t = t0 + 0.25; t < end - 1e-6; t += 0.5) hat(t, 0.1);
  for (let t = t0; t < end - 1e-6; t += 0.25) bass(t, 0.22, c.root + (Math.round((t - t0) / 0.25) % 4 === 3 ? 12 : 0));
  const arp = [c.tones[0] + 12, c.tones[1] + 12, c.tones[2] + 12, c.tones[1] + 24];
  for (let k = 0; t0 + k * 0.125 < end - 1e-6; k++) pluck(t0 + k * 0.125, arp[k % 4], 0.11, k % 2 ? 0.35 : -0.35);
});
// 17–25.1 s: under the explainer's narration
riser(16.0, 17.0, 0.08);
["C", "G", "Am", "F"].forEach((name, bar) => {
  const t0 = 17 + bar * 2;
  pad(t0, Math.min(2, 25.1 - t0), CHORDS[name].tones, 0.045, 0.4, 0.8);
});
for (let t = 17; t < 25; t += 1) bass(t, 0.9, [48, 43, 45, 41][Math.floor((t - 17) / 2)], 0.12);
// 25.1–30 s: end card
riser(24.1, 25.1, 0.12);
impact(25.1, 0.8);
pad(25.1, 3.3, [48, 55, 60, 64, 67], 0.075, 0.08, 1.4);
bass(25.1, 3.0, 36, 0.25);
bell(25.1, 84, 0.13, -0.2);
bell(25.6, 79, 0.1, 0.25);
bell(26.1, 88, 0.08, 0);

// ---------- reverb (Schroeder: 4 combs + 2 all-passes per channel) ----------
function reverb(x: Float32Array, spread: number) {
  const out = new Float32Array(N);
  for (const [ms, fb] of [[29.7, 0.8], [37.1, 0.78], [41.1, 0.77], [43.7, 0.76]] as const) {
    const d = Math.round(((ms + spread) / 1000) * SR);
    const buf = new Float32Array(N);
    let lp = 0;
    for (let i = 0; i < N; i++) {
      const prev = i >= d ? buf[i - d] : 0;
      lp += 0.4 * (prev - lp);
      buf[i] = x[i] + lp * fb;
      out[i] += buf[i] * 0.25;
    }
  }
  for (const ms of [5, 1.7]) {
    const d = Math.round(((ms + spread / 10) / 1000) * SR);
    const y = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const xd = i >= d ? out[i - d] : 0;
      const yd = i >= d ? y[i - d] : 0;
      y[i] = -0.6 * out[i] + xd + 0.6 * yd;
    }
    out.set(y);
  }
  return out;
}
const wet = [reverb(send[0], 0), reverb(send[1], 1.3)];

// ---------- master: sum, soft clip, normalize, fade, write ----------
const master = [new Float32Array(N), new Float32Array(N)];
let peak = 0;
for (let ch = 0; ch < 2; ch++) {
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const fadeOut = t > 28.6 ? Math.max(0, (30 - t) / 1.4) : 1;
    master[ch][i] = Math.tanh((dry[ch][i] + wet[ch][i] * 0.6) * 1.2) * fadeOut;
    peak = Math.max(peak, Math.abs(master[ch][i]));
  }
}
const norm = 0.89 / peak;

const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, master[0][i] * norm)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, master[1][i] * norm)) * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(2, 22); // stereo
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.concat([header, data]));
console.log(`wrote ${OUT} (${DUR}s, ${SR} Hz stereo)`);

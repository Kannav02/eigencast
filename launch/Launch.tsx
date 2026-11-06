/**
 * The 30-second eigencast launch video (1920×1080, 30 fps, 900 frames).
 *
 *   0–105     the problem: the pile of tools one explainer video usually needs
 *   105–180   title: they collapse into one point and "eigencast" appears
 *   180–510   the terminal: an agent runs eigencast from one sentence
 *   510–762   the payoff: a real eigencast video (README benchmark, Gemini 4 Argon run)
 *   762–900   end card with the install command
 *
 * House style from the package: pure black, Manim's palette, CMU Serif for prose.
 * Every frame is a pure function of the frame number (no randomness, clocks or timers).
 */
import { loadFont } from "@remotion/fonts";
import mono400 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2";
import mono500 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2";
import { useEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, interpolate, OffthreadVideo, Sequence, useCurrentFrame } from "remotion";
import { fontsLoaded } from "../src/stage/fonts";
import { COLORS, FONTS } from "../src/theme";
import clip from "../docs/benchmark/gemini-4-argon/video.mp4";
import music from "./assets/music.wav";

export const FPS = 30;
export const TOTAL = 900;
const T = { titleIn: 105, term: 180, video: 510, end: 762 };
const SERIF = FONTS.body;
const MONO = "'IBM Plex Mono', Menlo, monospace";
const C = COLORS;

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const prog = (f: number, a: number, b: number) => clamp((f - a) / (b - a));
const ease = (u: number) => u * u * (3 - 2 * u);
const fade = (f: number, a: number, d = 12) => ease(prog(f, a, a + d));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

// ---------------------------------------------------------------- fonts
let monoLoading: Promise<unknown> | null = null;
function allFonts() {
  monoLoading ??= Promise.all([
    loadFont({ family: "IBM Plex Mono", url: mono400, weight: "400" }),
    loadFont({ family: "IBM Plex Mono", url: mono500, weight: "500" }),
  ]);
  return Promise.all([fontsLoaded(), monoLoading]);
}

// ---------------------------------------------------------------- scene 1: the problem
type Win = { title: string; x: number; y: number; w: number; h: number; color: string; kind: "code" | "wave" | "tracks" | "list" };
const WINDOWS: Win[] = [
  { title: "scene.py — animation code", x: 90, y: 90, w: 600, h: 320, color: C.blue, kind: "code" },
  { title: "equations.tex", x: 1250, y: 70, w: 580, h: 300, color: C.purple, kind: "code" },
  { title: "voiceover_take_07.wav", x: 680, y: 30, w: 520, h: 230, color: C.green, kind: "wave" },
  { title: "timeline — video editor", x: 1150, y: 620, w: 680, h: 330, color: C.yellow, kind: "tracks" },
  { title: "audio editor", x: 140, y: 650, w: 620, h: 300, color: C.teal, kind: "wave" },
  { title: "sync-notes.txt", x: 720, y: 800, w: 500, h: 250, color: C.orange, kind: "list" },
];
const NOTES = ["scene 2 starts at 0:14?", "voice runs long: retime", "re-record take 8", "export, check, export again"];

function WindowBody({ win, f, i }: { win: Win; f: number; i: number }) {
  const bodyH = win.h - 44;
  if (win.kind === "code") {
    return (
      <svg width={win.w} height={bodyH}>
        {Array.from({ length: 7 }, (_, k) => {
          const w = 80 + ((k * 137 + i * 61) % 300);
          const indent = (k % 3) * 28;
          return (
            <g key={k}>
              <rect x={24 + indent} y={22 + k * 36} width={w} height={12} rx={6} fill={C.muted} opacity={0.35} />
              <rect x={24 + indent + w + 12} y={22 + k * 36} width={40 + ((k * 53) % 90)} height={12} rx={6} fill={win.color} opacity={0.55} />
            </g>
          );
        })}
      </svg>
    );
  }
  if (win.kind === "wave") {
    const pts = Array.from({ length: 120 }, (_, k) => {
      const x = 20 + (k / 119) * (win.w - 40);
      const a = Math.abs(Math.sin(k * 0.37 + i) * Math.sin(k * 0.11 + f * 0.08)) * (bodyH * 0.38);
      return `${x},${bodyH / 2 - a} ${x},${bodyH / 2 + a}`;
    });
    return (
      <svg width={win.w} height={bodyH}>
        <polyline points={pts.join(" ")} fill="none" stroke={win.color} strokeWidth={2} opacity={0.8} />
      </svg>
    );
  }
  if (win.kind === "tracks") {
    const head = 30 + ((f * 6) % (win.w - 60));
    return (
      <svg width={win.w} height={bodyH}>
        {[0, 1, 2].map((r) =>
          [0, 1, 2, 3].map((k) => (
            <rect key={`${r}${k}`} x={30 + k * 150 + r * 40} y={30 + r * 82} width={110 - r * 15} height={56} rx={6} fill="none" stroke={[C.blue, C.green, C.yellow][r]} strokeWidth={2} opacity={0.7} />
          )),
        )}
        <line x1={head} y1={14} x2={head} y2={bodyH - 10} stroke={C.red} strokeWidth={3} />
      </svg>
    );
  }
  return (
    <div style={{ padding: "18px 24px", fontFamily: MONO, fontSize: 24, lineHeight: "44px", color: C.muted }}>
      {NOTES.map((n) => (
        <div key={n}>– {n}</div>
      ))}
    </div>
  );
}

function Problem({ f }: { f: number }) {
  const collapse = ease(prog(f, 96, 124));
  const capIn = fade(f, 42, 14);
  const capOut = 1 - fade(f, 92, 10);
  return (
    <AbsoluteFill>
      {WINDOWS.map((w, i) => {
        const appear = 4 + i * 8;
        const pop = ease(prog(f, appear, appear + 10));
        const cx = w.x + w.w / 2;
        const cy = w.y + w.h / 2;
        const dx = lerp(0, 960 - cx, collapse);
        const dy = lerp(0, 540 - cy, collapse) + Math.sin(f / 18 + i * 1.7) * 5;
        const s = lerp(0.88, 1, pop) * lerp(1, 0.06, collapse);
        return (
          <div
            key={w.title}
            style={{
              position: "absolute", left: w.x, top: w.y, width: w.w, height: w.h,
              transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: pop * (1 - prog(f, 112, 124)),
              border: `2px solid ${w.color}`, borderRadius: 12, background: C.stage, overflow: "hidden",
            }}
          >
            <div style={{ height: 44, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", borderBottom: `1px solid ${w.color}55` }}>
              {[0, 1, 2].map((k) => (
                <span key={k} style={{ width: 12, height: 12, borderRadius: 6, border: `1.5px solid ${C.muted}` }} />
              ))}
              <span style={{ fontFamily: MONO, fontSize: 20, color: C.muted, marginLeft: 8 }}>{w.title}</span>
            </div>
            <WindowBody win={w} f={f} i={i} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 452, textAlign: "center", opacity: capIn * capOut }}>
        <div style={{ display: "inline-block", background: C.stage, padding: "18px 44px", borderRadius: 12 }}>
          <div style={{ fontFamily: SERIF, fontSize: 66, color: C.ink }}>One explainer video usually takes all of this.</div>
          <div style={{ fontFamily: SERIF, fontSize: 36, color: C.muted, marginTop: 10 }}>Animation code. A voice-over. Hours of syncing the two.</div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- arrow motif (an eigenvector)
function Arrow({ x1, y1, x2, y2, color = C.yellow, width = 6, opacity = 1 }: { x1: number; y1: number; x2: number; y2: number; color?: string; width?: number; opacity?: number }) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const head = Math.min(30, len * 0.4);
  const p = (a: number) => `${x2 - head * Math.cos(ang + a)},${y2 - head * Math.sin(ang + a)}`;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, opacity }}>
      <line x1={x1} y1={y1} x2={x2 - Math.cos(ang) * head * 0.6} y2={y2 - Math.sin(ang) * head * 0.6} stroke={color} strokeWidth={width} strokeLinecap="round" />
      {len > 2 && <polygon points={`${x2},${y2} ${p(0.42)} ${p(-0.42)}`} fill={color} />}
    </svg>
  );
}

function Title({ f }: { f: number }) {
  // The arrow grows from the point where the windows collapsed, then turns flat and becomes the underline.
  const grow = ease(prog(f, 112, 132));
  const turn = ease(prog(f, 128, 146));
  const ang = lerp(-0.45, 0, turn);
  const len = lerp(0, 560, grow);
  const x1 = lerp(960, 700, turn);
  const y1 = lerp(540, 590, turn);
  const out = 1 - fade(f, 168, 12);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Arrow x1={x1} y1={y1} x2={x1 + Math.cos(ang) * len} y2={y1 + Math.sin(ang) * len} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 380, textAlign: "center", fontFamily: SERIF, fontSize: 168, color: C.ink, opacity: fade(f, 134, 14), transform: `translateY(${lerp(16, 0, fade(f, 134, 14))}px)` }}>
        eigencast
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", fontFamily: SERIF, fontSize: 46, color: C.muted, opacity: fade(f, 146, 14) }}>
        Narrated explainer videos from one sentence.
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- scene 3: the terminal
type Seg = [text: string, color?: string];
type Line = { at: number; segs: Seg[]; progress?: [number, number] };
const PROMPT = "Make a short narrated video explaining the derivative as the slope of a tangent line.";
const TYPE_START = 192;
const TYPE_CPF = 3; // characters per frame
const TYPE_END = TYPE_START + Math.ceil(PROMPT.length / TYPE_CPF);
const cmd = (at: number, text: string): Line => ({ at, segs: [["$ ", C.yellow], [text, C.ink]] });
const out = (at: number, text: string, color: string = C.muted): Line => ({ at, segs: [["  " + text, color]] });
const note = (at: number, mark: string, markColor: string, text: string): Line => ({ at, segs: [[mark + " ", markColor], [text, C.ink]] });
// Clip lengths are estimated from the benchmark video's sentence boundaries; the other output lines follow the CLI's real formats.
const VOICE: [string, string][] = [["s0b0", "5.15"], ["s0b1", "5.94"], ["s0b2", "4.56"], ["s1b0", "8.28"], ["s1b1", "6.00"], ["s1b2", "5.28"]];
const LINES: Line[] = [
  note(TYPE_END + 8, "●", C.blue, "Reading .claude/skills/eigencast/SKILL.md"),
  cmd(TYPE_END + 20, "eigencast new derivative"),
  out(TYPE_END + 27, "Created videos/derivative/draw.js and script.json."),
  note(TYPE_END + 38, "✎", C.blue, "script.json   2 scenes · 6 sentences"),
  note(TYPE_END + 48, "✎", C.blue, "draw.js       a tangent line sliding along a curve"),
  cmd(TYPE_END + 60, "eigencast check derivative"),
  out(TYPE_END + 68, "0 error(s), 6 warning(s)", C.green),
  cmd(TYPE_END + 82, "eigencast voice derivative"),
  ...VOICE.map(([id, s], k) => out(TYPE_END + 90 + k * 6, `${id}: ${s}s`)),
  out(TYPE_END + 130, "recorded 6, reused 0; 6 clips, 35.21s of narration", C.green),
  cmd(TYPE_END + 144, "eigencast still derivative --beat s0b2"),
  out(TYPE_END + 153, "wrote out/derivative-f439.png (frame 439 of 1146)"),
  note(TYPE_END + 166, "●", C.red, "The definition text overflows its box. Fixing draw.js"),
  cmd(TYPE_END + 180, "eigencast still derivative --beat s0b2"),
  { at: TYPE_END + 189, segs: [["  wrote out/derivative-f439.png (frame 439 of 1146)  ", C.muted], ["✓", C.green]] },
  cmd(TYPE_END + 202, "eigencast render derivative"),
  { at: TYPE_END + 210, segs: [], progress: [TYPE_END + 210, TYPE_END + 248] },
  out(TYPE_END + 252, "wrote out/derivative.mp4 (38.2s, 1146 frames)", C.green),
];
const CAPTIONS: { at: number; phase: string; color: string; text: string }[] = [
  { at: T.term, phase: "ASK", color: C.blue, text: "You type one sentence to the agent you already use." },
  { at: TYPE_END + 20, phase: "SCRIPT", color: C.yellow, text: "It writes the narration and the drawing code." },
  { at: TYPE_END + 60, phase: "CHECK", color: C.red, text: "eigencast catches mistakes before anything slow runs." },
  { at: TYPE_END + 82, phase: "VOICE", color: C.green, text: "Every sentence is voiced by an AI model on your Mac." },
  { at: TYPE_END + 144, phase: "LOOK", color: C.teal, text: "The agent looks at real frames and fixes what's wrong." },
  { at: TYPE_END + 202, phase: "RENDER", color: C.purple, text: "Then every frame is drawn in sync with the voice." },
];
const LINE_H = 40;
const ROWS = 15;

function Terminal({ f }: { f: number }) {
  const inU = ease(prog(f, T.term - 8, T.term + 10));
  const outU = ease(prog(f, T.video - 14, T.video + 4));
  const typed = PROMPT.slice(0, Math.max(0, Math.floor((f - TYPE_START) * TYPE_CPF)));
  const shown = LINES.reduce((n, l) => n + ease(prog(f, l.at, l.at + 5)), 0);
  const scroll = Math.max(0, shown + 2 - ROWS) * LINE_H;
  const cursorOn = Math.floor(f / 15) % 2 === 0;
  const cap = [...CAPTIONS].reverse().find((c) => f >= c.at) ?? CAPTIONS[0];
  const capU = fade(f, cap.at, 8);
  return (
    <AbsoluteFill style={{ opacity: inU * (1 - outU) }}>
      <div
        style={{
          position: "absolute", left: 210, top: 60, width: 1500, height: 760,
          transform: `scale(${lerp(0.92, 1, inU) * lerp(1, 1.03, prog(f, T.term, T.video)) * lerp(1, 0.9, outU)})`,
          border: `2px solid #3a3a3a`, borderRadius: 16, background: C.stage, overflow: "hidden",
        }}
      >
        <div style={{ height: 52, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", borderBottom: "1px solid #2a2a2a" }}>
          {[0, 1, 2].map((k) => (
            <span key={k} style={{ width: 13, height: 13, borderRadius: 7, border: `1.5px solid ${C.muted}` }} />
          ))}
          <span style={{ flex: 1, textAlign: "center", fontFamily: MONO, fontSize: 20, color: C.muted, marginRight: 60 }}>my-videos — your coding agent</span>
        </div>
        <div style={{ position: "absolute", left: 40, right: 40, top: 76, bottom: 24, overflow: "hidden" }}>
          <div style={{ transform: `translateY(${-scroll}px)`, fontFamily: MONO, fontSize: 26, lineHeight: `${LINE_H}px`, whiteSpace: "pre" }}>
            <div style={{ color: C.ink }}>
              <span style={{ color: C.blue }}>{"> "}</span>
              {typed}
              {f < TYPE_END + 6 && <span style={{ opacity: cursorOn ? 1 : 0, background: C.ink, display: "inline-block", width: 14, height: 30, verticalAlign: -6, marginLeft: 2 }} />}
            </div>
            <div style={{ height: LINE_H / 2 }} />
            {LINES.map((l, k) => {
              const u = ease(prog(f, l.at, l.at + 5));
              if (u === 0) return null;
              let segs = l.segs;
              if (l.progress) {
                const p = prog(f, l.progress[0], l.progress[1]);
                const pct = Math.floor(p * 10) * 10;
                const bar = "█".repeat(Math.round(p * 24)) + "░".repeat(24 - Math.round(p * 24));
                segs = [["  rendering ", C.muted], [bar, C.purple], [`  ${pct}%`, C.ink]];
              }
              return (
                <div key={k} style={{ opacity: u, transform: `translateY(${(1 - u) * 8}px)` }}>
                  {segs.map(([text, color], j) => (
                    <span key={j} style={{ color }}>{text}</span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 160, right: 160, top: 872, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: capU }}>
        <span style={{ fontFamily: SERIF, fontSize: 24, letterSpacing: "0.16em", color: cap.color }}>{cap.phase}</span>
        <span style={{ fontFamily: SERIF, fontSize: 50, color: C.ink, transform: `translateY(${(1 - capU) * 10}px)` }}>{cap.text}</span>
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- scene 4: the real video
const CLIP_FROM = Math.round(17.1 * 30); // the benchmark video's "slide the point along the curve" sentence
const CLIP_LEN = T.end - T.video;

function Payoff({ f }: { f: number }) {
  const inU = ease(prog(f, T.video - 4, T.video + 14));
  const outU = ease(prog(f, T.end - 12, T.end + 4));
  return (
    <AbsoluteFill style={{ opacity: inU * (1 - outU) }}>
      <div style={{ position: "absolute", left: 240, top: 54, width: 1440, height: 810, border: "2px solid #3a3a3a", borderRadius: 10, overflow: "hidden", transform: `scale(${lerp(0.94, 1, inU)})` }}>
        <Sequence from={T.video} durationInFrames={CLIP_LEN} layout="none">
          <OffthreadVideo
            src={clip}
            startFrom={CLIP_FROM}
            style={{ width: 1440, height: 810 }}
            volume={(lf) => interpolate(lf, [0, 6, CLIP_LEN - 10, CLIP_LEN], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          />
        </Sequence>
      </div>
      <div style={{ position: "absolute", left: 240, right: 240, top: 892, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 24 }}>
        <span style={{ fontFamily: MONO, fontSize: 28, color: C.ink }}>
          <span style={{ color: C.green }}>▶ </span>out/derivative.mp4
        </span>
        <span style={{ fontFamily: SERIF, fontSize: 32, color: C.muted }}>Real eigencast output. Voice, timing and drawing all generated.</span>
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- scene 5: end card
function EndCard({ f }: { f: number }) {
  const u = fade(f, T.end, 14);
  const arrowU = ease(prog(f, T.end + 6, T.end + 26));
  const dark = 1 - fade(f, TOTAL - 18, 16);
  return (
    <AbsoluteFill style={{ opacity: u * dark }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 250, textAlign: "center", fontFamily: SERIF, fontSize: 168, color: C.ink }}>eigencast</div>
      <Arrow x1={700} y1={460} x2={lerp(700, 1260, arrowU)} y2={460} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 510, textAlign: "center", fontFamily: SERIF, fontSize: 48, color: C.muted, opacity: fade(f, T.end + 14, 12) }}>
        Narrated explainer videos from one sentence.
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, display: "flex", justifyContent: "center", opacity: fade(f, T.end + 26, 12) }}>
        <div style={{ fontFamily: MONO, fontSize: 40, color: C.ink, border: `2px solid ${C.yellow}`, borderRadius: 12, padding: "18px 40px" }}>
          <span style={{ color: C.yellow }}>$ </span>bunx eigencast init my-videos
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 800, textAlign: "center", fontFamily: SERIF, fontSize: 32, color: C.muted, opacity: fade(f, T.end + 38, 12) }}>
        Works with Claude Code, OpenCode, or any agent that can run commands.
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- root
export const Launch: React.FC = () => {
  const f = useCurrentFrame();
  const [handle] = useState(() => delayRender("launch fonts"));
  useEffect(() => {
    allFonts().then(() => continueRender(handle));
  }, [handle]);
  const musicVolume = (mf: number) =>
    interpolate(mf, [0, T.video - 10, T.video + 10, T.end - 10, T.end], [1, 1, 0.3, 0.3, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.stage }}>
      <Audio src={music} volume={musicVolume} />
      {f < T.titleIn + 25 && <Problem f={f} />}
      {f >= T.titleIn && f < T.term + 5 && <Title f={f} />}
      {f >= T.term - 10 && f < T.video + 8 && <Terminal f={f} />}
      {f >= T.video - 6 && f < T.end + 6 && <Payoff f={f} />}
      {f >= T.end && <EndCard f={f} />}
    </AbsoluteFill>
  );
};


/**
 * The 30-second eigencast launch video (1920×1080, 30 fps, 900 frames).
 *
 *   0–80      a terminal on a wallpaper: the user types a request to Claude Code
 *   80–150    title card on the wallpaper
 *   150–505   Claude Code runs eigencast; a pop-up shows the test frame it looks at
 *   505–753   the finished video plays in a player window (real output, with narration)
 *   753–900   end card with the install command
 *
 * The payoff clip and the still are from the README benchmark's Claude Code run
 * (docs/benchmark/claude-opus-5-5). The transcript follows that run with eigencast's real
 * output formats; it is a reconstruction, not a screen recording.
 * Every frame is a pure function of the frame number (no randomness, clocks or timers).
 */
import mono400 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2";
import mono500 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2";
import { loadFont } from "@remotion/fonts";
import { useEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, Img, interpolate, OffthreadVideo, Sequence, useCurrentFrame } from "remotion";
import clip from "../docs/benchmark/claude-opus-5-5/video.mp4";
import { fontsLoaded } from "../src/stage/fonts";
import { COLORS, FONTS } from "../src/theme";
import music from "./assets/music.wav";
import still from "./stills/derivative-f558.png";

export const FPS = 30;
export const TOTAL = 900;
const T = { submit: 70, title: 80, work: 150, video: 505, end: 753 };
const SERIF = FONTS.body;
const MONO = "'IBM Plex Mono', Menlo, monospace";

/** Text on the wallpaper: dark ink, and darker versions of Manim's colors so they read on a light ground. */
const INK = "#0f1720";
const SUB = "#43515f";
const DEEP = { blue: "#1b6f8a", yellow: "#8a6a00", red: "#b03a2e", green: "#3d7a27", teal: "#1e7a63", purple: "#6e4a8a" };
/** Terminal colors. */
const TERM = { bg: "#161616", bar: "#222222", line: "#3a3a3a", text: "#e8e8e8", dim: "#9a9a9a", green: COLORS.green, yellow: COLORS.yellow };

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const prog = (f: number, a: number, b: number) => clamp((f - a) / (b - a));
const ease = (u: number) => u * u * (3 - 2 * u);
const fade = (f: number, a: number, d = 12) => ease(prog(f, a, a + d));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

let monoLoading: Promise<unknown> | null = null;
function allFonts() {
  monoLoading ??= Promise.all([
    loadFont({ family: "IBM Plex Mono", url: mono400, weight: "400" }),
    loadFont({ family: "IBM Plex Mono", url: mono500, weight: "500" }),
  ]);
  return Promise.all([fontsLoaded(), monoLoading]);
}

// ---------------------------------------------------------------- wallpaper
const CURVES = Array.from({ length: 9 }, (_, i) => ({ y: 60 + i * 120, amp: 26 + (i % 4) * 12, k: 0.0028 + (i % 3) * 0.0011, ph: i * 1.3, speed: 0.6 + (i % 2) * 0.5 }));

function Wallpaper({ f }: { f: number }) {
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg, #e6edf3 0%, #d6e1ea 55%, #c8d6e2 100%)" }}>
      <svg width={1920} height={1080}>
        {Array.from({ length: 17 }, (_, i) => (
          <line key={`v${i}`} x1={i * 120} y1={0} x2={i * 120} y2={1080} stroke="#1b4a66" strokeOpacity={0.045} strokeWidth={1.5} />
        ))}
        {CURVES.map((c, i) => {
          const pts = Array.from({ length: 97 }, (_, k) => {
            const x = k * 20;
            return `${x},${c.y + c.amp * Math.sin(x * c.k + c.ph + f * 0.01 * c.speed)}`;
          });
          return <polyline key={i} points={pts.join(" ")} fill="none" stroke="#1b4a66" strokeOpacity={0.1} strokeWidth={2.5} />;
        })}
      </svg>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- window chrome
function Chrome({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: 14, overflow: "hidden", background: TERM.bg, boxShadow: "0 30px 80px rgba(15,35,55,0.35), 0 0 0 1px rgba(0,0,0,0.25)" }}>
      <div style={{ height: 44, background: TERM.bar, display: "flex", alignItems: "center", padding: "0 18px", gap: 9, borderBottom: `1px solid ${TERM.line}` }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
        ))}
        <span style={{ flex: 1, textAlign: "center", fontFamily: MONO, fontSize: 18, color: TERM.dim, marginRight: right ? 0 : 66 }}>{title}</span>
        {right}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 44, bottom: 0 }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- the Claude Code session
const PROMPT = "make a short explainer video on what a derivative is, using eigencast";
const TYPE = { start: 14, cpf: 1.45 };
const P = T.work;

type Call = { kind: "call"; at: number; done: number; tool: string; arg: string; result: string; spinner?: string };
type Row = { kind: "header"; at: number } | { kind: "user"; at: number; text: string } | { kind: "say"; at: number; text: string } | { kind: "gap"; at: number } | Call;

const ROWS: Row[] = [
  { kind: "header", at: 0 },
  { kind: "user", at: T.submit, text: PROMPT },
  { kind: "gap", at: T.submit },
  { kind: "say", at: P + 6, text: "I'll make it with eigencast. Reading its skill first." },
  { kind: "call", at: P + 18, done: P + 26, tool: "Read", arg: ".claude/skills/eigencast/SKILL.md", result: "Read 112 lines" },
  { kind: "call", at: P + 36, done: P + 46, tool: "Bash", arg: "bunx eigencast new derivative", result: "Created videos/derivative/draw.js and script.json." },
  { kind: "call", at: P + 58, done: P + 66, tool: "Write", arg: "videos/derivative/script.json", result: "Wrote 15 lines to videos/derivative/script.json" },
  { kind: "call", at: P + 76, done: P + 84, tool: "Write", arg: "videos/derivative/draw.js", result: "Wrote 96 lines to videos/derivative/draw.js" },
  { kind: "call", at: P + 96, done: P + 108, tool: "Bash", arg: "bunx eigencast check derivative", result: "0 error(s), 6 warning(s)" },
  { kind: "call", at: P + 118, done: P + 168, tool: "Bash", arg: "bunx eigencast voice derivative", result: "recorded 6, reused 0; 6 clips, 43.3s of narration", spinner: "Recording narration" },
  { kind: "call", at: P + 178, done: P + 192, tool: "Bash", arg: "bunx eigencast still derivative --beat s0b2", result: "wrote out/derivative-f558.png (frame 558 of 1390)" },
  { kind: "call", at: P + 200, done: P + 208, tool: "Read", arg: "out/derivative-f558.png", result: "Read image (172KB)" },
  { kind: "say", at: P + 236, text: "The secant is closing in on the tangent, and nothing overlaps. Rendering." },
  { kind: "call", at: P + 248, done: P + 306, tool: "Bash", arg: "bunx eigencast render derivative", result: "wrote out/derivative.mp4 (46.3s, 1390 frames)", spinner: "Rendering 1390 frames" },
  { kind: "say", at: P + 316, text: "Done: out/derivative.mp4, a 46-second narrated video in two scenes." },
];
const rowHeight = (r: Row) => (r.kind === "header" ? 3 : r.kind === "call" ? 2 : 1);
const LINE = 36;
const POPUP = { in: P + 208, out: P + 242 };

const CAPTIONS: { at: number; phase: string; color: string; text: string }[] = [
  { at: P, phase: "SKILL", color: DEEP.blue, text: "Claude Code learns eigencast from its skill file." },
  { at: P + 58, phase: "SCRIPT", color: DEEP.yellow, text: "It writes the narration and the drawing code." },
  { at: P + 96, phase: "CHECK", color: DEEP.red, text: "eigencast checks the files before anything slow runs." },
  { at: P + 118, phase: "VOICE", color: DEEP.green, text: "Each sentence is voiced by an AI model on your Mac." },
  { at: P + 178, phase: "LOOK", color: DEEP.teal, text: "Claude looks at a real frame before rendering." },
  { at: P + 248, phase: "RENDER", color: DEEP.purple, text: "Then every frame is drawn in sync with the voice." },
];

function Dot({ color, on = true }: { color: string; on?: boolean }) {
  return <span style={{ color, opacity: on ? 1 : 0.25 }}>⏺ </span>;
}

function Transcript({ f, height }: { f: number; height: number }) {
  const shown = ROWS.reduce((n, r) => n + ease(prog(f, r.at, r.at + 4)) * rowHeight(r), 0);
  const visible = Math.floor(height / LINE) - 1;
  const offset = Math.max(0, shown - visible) * LINE;
  return (
    <div style={{ position: "absolute", left: 32, right: 32, top: 18, height, overflow: "hidden" }}>
      <div style={{ transform: `translateY(${-offset}px)`, fontFamily: MONO, fontSize: 24, lineHeight: `${LINE}px`, color: TERM.text, whiteSpace: "pre" }}>
        {ROWS.map((r, i) => {
          const u = ease(prog(f, r.at, r.at + 4));
          if (u === 0) return null;
          const style = { opacity: u, transform: `translateY(${(1 - u) * 6}px)` };
          if (r.kind === "header")
            return (
              <div key={i} style={{ ...style, height: LINE * 3 - 12, marginBottom: 12, border: `1.5px solid ${TERM.line}`, borderRadius: 10, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 20px" }}>
                <div>
                  <span style={{ color: TERM.yellow }}>✻ </span>
                  <span style={{ fontWeight: 500 }}>Claude Code</span>
                </div>
                <div style={{ color: TERM.dim, fontSize: 20 }}>~/my-videos</div>
              </div>
            );
          if (r.kind === "gap") return <div key={i} style={{ height: LINE }} />;
          if (r.kind === "user")
            return (
              <div key={i} style={{ ...style, color: TERM.dim }}>
                {"> "}
                {r.text}
              </div>
            );
          if (r.kind === "say")
            return (
              <div key={i} style={style}>
                <Dot color={TERM.text} />
                {r.text}
              </div>
            );
          const done = f >= r.done;
          const blink = Math.floor(f / 8) % 2 === 0;
          return (
            <div key={i} style={style}>
              <div>
                <Dot color={done ? TERM.green : TERM.dim} on={done || blink} />
                <span style={{ fontWeight: 500 }}>{r.tool}</span>
                <span style={{ color: TERM.dim }}>(</span>
                {r.arg}
                <span style={{ color: TERM.dim }}>)</span>
              </div>
              <div style={{ color: TERM.dim, opacity: done ? 1 : 0 }}>
                {"  ⎿  "}
                {r.result}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SPIN = ["·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"];

function InputArea({ f }: { f: number }) {
  const typed = f < T.submit ? PROMPT.slice(0, Math.max(0, Math.floor((f - TYPE.start) * TYPE.cpf))) : "";
  const active = ROWS.find((r): r is Call => r.kind === "call" && !!r.spinner && f >= r.at && f < r.done);
  const thinking = f >= T.submit && f < P + 6;
  const spinText = active?.spinner ?? (thinking ? "Thinking" : null);
  const since = active ? Math.floor((f - active.at) / FPS) : 0;
  const cursorOn = Math.floor(f / 15) % 2 === 0;
  return (
    <div style={{ position: "absolute", left: 32, right: 32, bottom: 14, fontFamily: MONO, fontSize: 24 }}>
      <div style={{ height: 38, color: TERM.yellow, opacity: spinText ? 1 : 0 }}>
        {SPIN[Math.floor(f / 3) % SPIN.length]} {spinText}…<span style={{ color: TERM.dim }}>{active ? `  (${since}s · esc to interrupt)` : ""}</span>
      </div>
      <div style={{ border: `1.5px solid ${TERM.line}`, borderRadius: 10, padding: "10px 16px", color: TERM.text, minHeight: 56, whiteSpace: "pre" }}>
        <span style={{ color: TERM.dim }}>{"> "}</span>
        {typed}
        <span style={{ display: "inline-block", width: 13, height: 28, verticalAlign: -5, background: TERM.text, opacity: cursorOn ? 0.9 : 0 }} />
      </div>
      <div style={{ color: TERM.dim, fontSize: 18, marginTop: 8 }}>⏵⏵ auto-accept edits on (shift+tab to cycle)</div>
    </div>
  );
}

type Rect = { x: number; y: number; w: number; h: number };
const RECT_ASK: Rect = { x: 360, y: 150, w: 1200, h: 700 };
const RECT_WORK: Rect = { x: 210, y: 34, w: 1500, h: 820 };

function Terminal({ f }: { f: number }) {
  const asking = f < T.work - 10;
  const r = asking ? RECT_ASK : RECT_WORK;
  const opacity = asking ? fade(f, 0, 14) * (1 - fade(f, T.title - 2, 12)) : fade(f, T.work - 6, 14) * (1 - fade(f, T.video - 12, 14));
  const scale = asking ? lerp(0.94, 1, fade(f, 0, 14)) : lerp(0.96, 1, fade(f, T.work - 6, 14)) * lerp(1, 0.94, fade(f, T.video - 12, 14));
  const shift = -170 * ease(prog(f, POPUP.in - 6, POPUP.in + 10)) * (1 - ease(prog(f, POPUP.out, POPUP.out + 14)));
  const bodyH = r.h - 44;
  return (
    <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, opacity, transform: `translateX(${shift}px) scale(${scale})` }}>
      <Chrome title="my-videos — claude">
        <Transcript f={f} height={bodyH - 18 - 150} />
        <InputArea f={f} />
      </Chrome>
    </div>
  );
}

function StillPopup({ f }: { f: number }) {
  const u = ease(prog(f, POPUP.in, POPUP.in + 12)) * (1 - ease(prog(f, POPUP.out, POPUP.out + 12)));
  if (u === 0) return null;
  return (
    <div style={{ position: "absolute", left: 1090, top: 250, width: 780, height: 44 + 439, opacity: u, transform: `translateY(${(1 - u) * 30}px) scale(${lerp(0.94, 1, u)})` }}>
      <Chrome title="out/derivative-f558.png">
        <Img src={still} style={{ width: 780, height: 439, display: "block" }} />
      </Chrome>
    </div>
  );
}

function Captions({ f }: { f: number }) {
  if (f < T.work || f >= T.video) return null;
  const cap = [...CAPTIONS].reverse().find((c) => f >= c.at) ?? CAPTIONS[0];
  const u = fade(f, cap.at, 8) * (1 - fade(f, T.video - 14, 10));
  return (
    <div style={{ position: "absolute", left: 160, right: 160, top: 884, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: u }}>
      <span style={{ fontFamily: SERIF, fontSize: 24, letterSpacing: "0.16em", color: cap.color, fontWeight: 700 }}>{cap.phase}</span>
      <span style={{ fontFamily: SERIF, fontSize: 50, color: INK, transform: `translateY(${(1 - u) * 8}px)` }}>{cap.text}</span>
    </div>
  );
}

// ---------------------------------------------------------------- arrow motif and title
function Arrow({ x1, y1, x2, y2, color, width = 6 }: { x1: number; y1: number; x2: number; y2: number; color: string; width?: number }) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const head = Math.min(30, len * 0.4);
  const p = (a: number) => `${x2 - head * Math.cos(ang + a)},${y2 - head * Math.sin(ang + a)}`;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
      <line x1={x1} y1={y1} x2={x2 - Math.cos(ang) * head * 0.6} y2={y2 - Math.sin(ang) * head * 0.6} stroke={color} strokeWidth={width} strokeLinecap="round" />
      {len > 2 && <polygon points={`${x2},${y2} ${p(0.42)} ${p(-0.42)}`} fill={color} />}
    </svg>
  );
}

function Title({ f }: { f: number }) {
  const u = fade(f, T.title + 4, 14);
  const out = 1 - fade(f, T.work - 14, 10);
  const arrow = ease(prog(f, T.title + 10, T.title + 30));
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, textAlign: "center", fontFamily: SERIF, fontSize: 176, color: INK, opacity: u, transform: `translateY(${(1 - u) * 18}px)` }}>eigencast</div>
      <Arrow x1={690} y1={560} x2={lerp(690, 1250, arrow)} y2={560} color={DEEP.blue} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 600, textAlign: "center", fontFamily: SERIF, fontSize: 48, color: SUB, opacity: fade(f, T.title + 18, 12) }}>
        Narrated explainer videos, made by your coding agent.
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- the finished video
const CLIP_FROM = Math.round(14.4 * 30); // "Now slide the second point toward the first…"
const CLIP_LEN = T.end - T.video;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function Player({ f }: { f: number }) {
  const u = ease(prog(f, T.video - 6, T.video + 12)) * (1 - ease(prog(f, T.end - 12, T.end + 4)));
  if (u === 0) return null;
  const pos = (CLIP_FROM + clamp(f - T.video, 0, CLIP_LEN)) / FPS;
  return (
    <AbsoluteFill style={{ opacity: u }}>
      <div style={{ position: "absolute", left: 220, top: 36, width: 1480, height: 44 + 833, transform: `scale(${lerp(0.93, 1, u)})` }}>
        <Chrome title="derivative.mp4" right={<span style={{ fontFamily: MONO, fontSize: 18, color: TERM.dim }}>{mmss(pos)} / 0:46</span>}>
          <Sequence from={T.video} durationInFrames={CLIP_LEN} layout="none">
            <OffthreadVideo
              src={clip}
              startFrom={CLIP_FROM}
              style={{ width: 1480, height: 833, display: "block" }}
              volume={(lf) => interpolate(lf, [0, 6, CLIP_LEN - 10, CLIP_LEN], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
            />
          </Sequence>
        </Chrome>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 952, textAlign: "center", fontFamily: SERIF, fontSize: 40, color: INK }}>
        Made by Claude Code with eigencast. <span style={{ color: SUB }}>Real output, narration included.</span>
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- end card
function EndCard({ f }: { f: number }) {
  const u = fade(f, T.end, 14);
  const arrow = ease(prog(f, T.end + 6, T.end + 26));
  return (
    <AbsoluteFill style={{ opacity: u }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 230, textAlign: "center", fontFamily: SERIF, fontSize: 176, color: INK }}>eigencast</div>
      <Arrow x1={690} y1={460} x2={lerp(690, 1250, arrow)} y2={460} color={DEEP.blue} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 500, textAlign: "center", fontFamily: SERIF, fontSize: 50, color: SUB, opacity: fade(f, T.end + 14, 12) }}>
        Narrated explainer videos, made by your coding agent.
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, display: "flex", justifyContent: "center", opacity: fade(f, T.end + 26, 12) }}>
        <div style={{ fontFamily: MONO, fontSize: 40, color: TERM.text, background: TERM.bg, borderRadius: 14, padding: "20px 44px", boxShadow: "0 20px 50px rgba(15,35,55,0.3)" }}>
          <span style={{ color: TERM.yellow }}>$ </span>bunx eigencast init my-videos
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 810, textAlign: "center", fontFamily: SERIF, fontSize: 34, color: SUB, opacity: fade(f, T.end + 38, 12) }}>
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
  const musicVolume = (mf: number) => interpolate(mf, [0, T.video - 10, T.video + 10, T.end - 10, T.end], [1, 1, 0.3, 0.3, 1], { extrapolateRight: "clamp" });
  const toBlack = fade(f, TOTAL - 18, 16);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Audio src={music} volume={musicVolume} />
      <Wallpaper f={f} />
      {f < T.title + 16 && <Terminal f={f} />}
      {f >= T.title && f < T.work + 4 && <Title f={f} />}
      {f >= T.work - 10 && f < T.video + 6 && <Terminal f={f} />}
      <StillPopup f={f} />
      <Captions f={f} />
      <Player f={f} />
      {f >= T.end && <EndCard f={f} />}
      <AbsoluteFill style={{ background: "#000", opacity: toBlack }} />
    </AbsoluteFill>
  );
};

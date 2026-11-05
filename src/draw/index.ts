/**
 * Drawing kit for canvas scenes. A video is a list of scenes; each scene draws one moment
 * from its scene time `t` (seconds) using the kit `d`. Everything is in 960×540 design units.
 *
 *   import { defineVideo, COLORS } from "eigencast/draw";
 *   export default defineVideo([
 *     { name: "Intro", dur: 8, beats: [[0, "IDEA", "Caption shown under the picture"]],
 *       draw(t, d) { d.text("Hello", 480, 270, { size: 40, align: "center", alpha: d.fade(t, 0) }); } },
 *   ]);
 *
 * Every frame must be a pure function of t: use d.rng(seed), never Math.random or the clock.
 */
import type { RenderFrame } from "../stage/NarratedCanvas";
import { COLORS, FONTS, TEXT_SCALE } from "../theme";
import type { Beat, SceneDef } from "../timeline";

export { COLORS, PHASE_COLORS, FONTS, TEXT_SCALE } from "../theme";
export type { Beat, SceneDef } from "../timeline";

// ---------- pure math (also exported on their own) ----------
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** Smoothstep: eases 0→1 in and out. */
export const ease = (u: number) => u * u * (3 - 2 * u);
/** 0 before `a`, 1 after `b`, linear in between. */
export const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
/** Eased 0→1 starting at `start` and lasting `dur` seconds. Use for fade-ins and draw-ons. */
export const fade = (t: number, start: number, dur = 0.6) => ease(prog(t, start, start + dur));
/** Seeded random numbers in [0, 1) (mulberry32). Same seed, same sequence, every frame. */
export function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Standard normal sample from a seeded generator. */
export function gauss(r: () => number): number {
  let u = 0;
  while (!u) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

// ---------- kit ----------
type Style = { color?: string; alpha?: number; width?: number; dash?: number[] };
type TextStyle = { size?: number; color?: string; alpha?: number; align?: CanvasTextAlign; weight?: 500 | 700; italic?: boolean };
export type Range = [number, number];
/** A plot area: a rectangle in design units mapped to a data range. */
export type Plot = { x: number; y: number; w: number; h: number; xRange: Range; yRange: Range; X: (v: number) => number; Y: (v: number) => number };
export type Point = { x: number; y: number };

/** Build the drawing kit bound to one canvas context. */
export function makeKit(ctx: CanvasRenderingContext2D) {
  const setAlpha = (a = 1) => {
    ctx.globalAlpha = clamp(a);
  };
  const stroke = (s: Style, fallback: string = COLORS.ink) => {
    setAlpha(s.alpha);
    ctx.strokeStyle = s.color ?? fallback;
    ctx.lineWidth = s.width ?? 2;
    ctx.setLineDash(s.dash ?? []);
  };

  const kit = {
    ctx,
    clamp, lerp, ease, prog, fade, rng, gauss,
    COLORS,

    /** Text at (x, y) baseline. Default size 18 design px, white, left aligned. */
    text(s: string, x: number, y: number, o: TextStyle = {}) {
      setAlpha(o.alpha);
      ctx.font = `${o.italic ? "italic " : ""}${o.weight ?? 500} ${Math.round((o.size ?? 18) * TEXT_SCALE)}px ${FONTS.body}`;
      ctx.fillStyle = o.color ?? COLORS.ink;
      ctx.textAlign = o.align ?? "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(s, x, y);
    },
    line(x1: number, y1: number, x2: number, y2: number, o: Style = {}) {
      stroke(o);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    },
    /** Line with a filled head at (x2, y2). */
    arrow(x1: number, y1: number, x2: number, y2: number, o: Style = {}) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 2) return;
      kit.line(x1, y1, x2, y2, o);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const L = Math.min(9, len * 0.5);
      setAlpha(o.alpha);
      ctx.fillStyle = o.color ?? COLORS.ink;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - L * Math.cos(ang - 0.45), y2 - L * Math.sin(ang - 0.45));
      ctx.lineTo(x2 - L * Math.cos(ang + 0.45), y2 - L * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fill();
    },
    /** Outlined rectangle (house style: outlines, no filled cards). */
    rect(x: number, y: number, w: number, h: number, o: Style = {}) {
      stroke(o);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    },
    /** Outlined circle. */
    circle(x: number, y: number, r: number, o: Style = {}) {
      stroke(o);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    },
    /** Filled dot. */
    dot(x: number, y: number, r = 4.5, o: { color?: string; alpha?: number } = {}) {
      setAlpha(o.alpha);
      ctx.fillStyle = o.color ?? COLORS.ink;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    },
    /** Map a data range onto a rectangle. Returns X(v) and Y(v) converters. */
    plot(o: { x: number; y: number; w: number; h: number; xRange: Range; yRange: Range }): Plot {
      const [x0, x1] = o.xRange;
      const [y0, y1] = o.yRange;
      return { ...o, X: (v) => o.x + ((v - x0) / (x1 - x0)) * o.w, Y: (v) => o.y + o.h - ((v - y0) / (y1 - y0)) * o.h };
    },
    /** Axes with tick labels and faint grid lines. */
    axes(P: Plot, o: { xTicks?: number[]; yTicks?: number[]; xLabel?: string; yLabel?: string; alpha?: number } = {}) {
      const a = o.alpha ?? 1;
      const bottom = P.y + P.h;
      (o.yTicks ?? []).forEach((v) => {
        kit.line(P.x, P.Y(v), P.x + P.w, P.Y(v), { color: COLORS.grid, width: 1, alpha: a * 0.7 });
        kit.text(String(v), P.x - 10, P.Y(v) + 5, { size: 13, color: COLORS.muted, align: "right", alpha: a });
      });
      (o.xTicks ?? []).forEach((v) => kit.text(String(v), P.X(v), bottom + 20, { size: 13, color: COLORS.muted, align: "center", alpha: a }));
      kit.line(P.x, bottom, P.x + P.w, bottom, { color: COLORS.muted, width: 1.2, alpha: a });
      kit.line(P.x, P.y, P.x, bottom, { color: COLORS.muted, width: 1.2, alpha: a });
      if (o.xLabel) kit.text(o.xLabel, P.x + P.w, bottom + 40, { size: 14, color: COLORS.muted, align: "right", alpha: a });
      if (o.yLabel) kit.text(o.yLabel, P.x, P.y - 12, { size: 14, color: COLORS.muted, alpha: a });
    },
    /** Graph of y = f(x) inside a plot, from x = from to x = to (animate `to` to draw it on). */
    curve(P: Plot, f: (x: number) => number, o: Style & { from?: number; to?: number } = {}) {
      const from = o.from ?? P.xRange[0];
      const to = o.to ?? P.xRange[1];
      if (to <= from) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(P.x - 2, P.y - 2, P.w + 4, P.h + 4);
      ctx.clip();
      stroke({ width: 2.5, ...o });
      ctx.beginPath();
      const N = 300;
      for (let i = 0; i <= N; i++) {
        const x = from + ((to - from) * i) / N;
        if (i) ctx.lineTo(P.X(x), P.Y(f(x)));
        else ctx.moveTo(P.X(x), P.Y(f(x)));
      }
      ctx.stroke();
      ctx.restore();
    },
    /** Scatter points in a plot. `color` may be a function of the point. */
    points(P: Plot, pts: Point[], o: { color?: string | ((p: Point, i: number) => string); r?: number; alpha?: number } = {}) {
      pts.forEach((p, i) => {
        const color = typeof o.color === "function" ? o.color(p, i) : o.color;
        kit.dot(P.X(p.x), P.Y(p.y), o.r ?? 4.5, { color, alpha: o.alpha });
      });
    },
  };
  return kit;
}

export type Kit = ReturnType<typeof makeKit>;
export type Scene = { name: string; dur: number; beats: Beat[]; draw: (t: number, d: Kit) => void };

/**
 * Turn a list of scenes into what the renderer needs.
 * 1. SCENES: name, design duration and beats of each scene (drives the timeline).
 * 2. renderFrame: clear to black, scale design units, draw the scene title, call scene.draw(t, kit).
 */
export function defineVideo(scenes: Scene[], options: { titles?: boolean } = {}): { SCENES: SceneDef[]; renderFrame: RenderFrame } {
  const titles = options.titles ?? true;
  const renderFrame: RenderFrame = (ctx, sceneIndex, t, scale) => {
    const s = scenes[sceneIndex];
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.stage;
    ctx.fillRect(0, 0, 960, 540);
    const d = makeKit(ctx);
    if (titles) d.text(s.name, 60, 56, { size: 32 });
    s.draw(t, d);
    ctx.globalAlpha = 1;
  };
  return { SCENES: scenes.map(({ name, dur, beats }) => ({ name, dur, beats })), renderFrame };
}

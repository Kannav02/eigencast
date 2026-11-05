import { defineVideo, COLORS } from "eigencast/draw";

const f = (x) => 0.08 * x ** 3 - 0.9 * x ** 2 + 2.5 * x + 2;
const df = (x) => 0.24 * x ** 2 - 1.8 * x + 2.5;
const FLAT = [(1.8 - Math.sqrt(0.84)) / 0.48, (1.8 + Math.sqrt(0.84)) / 0.48];

const fmt = (v) => (Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2));

const plotOf = (d) => d.plot({ x: 120, y: 110, w: 720, h: 330, xRange: [0, 9], yRange: [0, 10] });

// Line through canvas point (cx, cy) along data slope m, half-length L in canvas units.
function slopeLine(d, P, x0, y0, m, L, opts) {
  const vx = P.X(1) - P.X(0);
  const vy = P.Y(m) - P.Y(0);
  const n = Math.hypot(vx, vy);
  const cx = P.X(x0), cy = P.Y(y0);
  d.line(cx - (vx / n) * L, cy - (vy / n) * L, cx + (vx / n) * L, cy + (vy / n) * L, opts);
}

function base(t, d, P) {
  d.axes(P, { xTicks: [0, 3, 6, 9], yTicks: [0, 5, 10], xLabel: "x", yLabel: "y", alpha: d.fade(t, 0) });
  d.curve(P, f, { color: COLORS.blue, to: d.lerp(0, 9, d.fade(t, 0.3, 2.5)) });
}

export default defineVideo([
  {
    name: "Slope between two points",
    dur: 13,
    beats: [
      [0, "IDEA", "A curve whose steepness keeps changing."],
      [4, "EXAMPLE", "Slope between two points = Δy / Δx."],
      [8, "IDEA", "As h → 0, the secant becomes the tangent."],
    ],
    draw(t, d) {
      const P = plotOf(d);
      base(t, d, P);
      d.text("y = f(x)", P.X(8.1), P.Y(3.2), { size: 20, color: COLORS.blue, align: "left", alpha: d.fade(t, 2) });

      const a = 1.5;
      const h = d.lerp(5, 0.02, d.ease(d.prog(t, 8.5, 12)));
      const b = a + h;
      const m = (f(b) - f(a)) / h;
      const A = d.fade(t, 4);
      if (A > 0) {
        const mid = a + h / 2;
        const L = Math.hypot(P.X(b) - P.X(a), P.Y(f(b)) - P.Y(f(a))) / 2 + 70;
        slopeLine(d, P, mid, (f(a) + f(b)) / 2, m, L, { color: COLORS.yellow, alpha: A });
        // Δx and Δy legs
        const legA = A * (1 - d.fade(t, 8.5, 1));
        d.line(P.X(a), P.Y(f(a)), P.X(b), P.Y(f(a)), { color: COLORS.muted, dash: [6, 4], alpha: legA });
        d.line(P.X(b), P.Y(f(a)), P.X(b), P.Y(f(b)), { color: COLORS.muted, dash: [6, 4], alpha: legA });
        d.text("Δx = h", (P.X(a) + P.X(b)) / 2, P.Y(f(a)) - 10, { size: 16, color: COLORS.muted, align: "center", alpha: legA });
        d.text("Δy", P.X(b) + 10, (P.Y(f(a)) + P.Y(f(b))) / 2, { size: 16, color: COLORS.muted, alpha: legA });
        d.dot(P.X(a), P.Y(f(a)), 6, { color: COLORS.ink, alpha: A });
        d.dot(P.X(b), P.Y(f(b)), 6, { color: COLORS.ink, alpha: A });
        d.text(`slope = ${fmt(m)}`, 150, 140, { size: 22, color: COLORS.yellow, align: "left", alpha: A });
        d.text(`h = ${h.toFixed(2)}`, 150, 170, { size: 20, color: COLORS.muted, align: "left", alpha: d.fade(t, 8) });
      }
    },
  },
  {
    name: "The derivative",
    dur: 14,
    beats: [
      [0, "RESULT", "f′(a) = slope of the tangent line at a."],
      [4, "EXAMPLE", "Slide the point: the slope changes with it."],
      [10, "RESULT", "f′ = 0 where the tangent is flat."],
    ],
    draw(t, d) {
      const P = plotOf(d);
      d.axes(P, { xTicks: [0, 3, 6, 9], yTicks: [0, 5, 10], xLabel: "x", yLabel: "y" });
      d.curve(P, f, { color: COLORS.blue });

      // a slides 1.5 -> 8 during beat 1, then parks on the second flat point.
      const slide = d.ease(d.prog(t, 4.5, 9.5));
      const park = d.ease(d.prog(t, 10.3, 12));
      const a = d.lerp(d.lerp(1.5, 8, slide), FLAT[1], park);
      const m = df(a);
      const col = Math.abs(m) < 0.05 ? COLORS.green : m > 0 ? COLORS.yellow : COLORS.red;
      const A = d.fade(t, 0.3);

      slopeLine(d, P, a, f(a), m, 110, { color: col, width: 3, alpha: A });
      d.dot(P.X(a), P.Y(f(a)), 6, { color: COLORS.ink, alpha: A });
      d.line(P.X(a), P.Y(f(a)), P.X(a), P.Y(0), { color: COLORS.muted, dash: [4, 4], width: 1.5, alpha: A * 0.7 });
      d.text("a", P.X(a), P.Y(0) + 40, { size: 18, color: COLORS.ink, align: "center", italic: true, alpha: A });

      d.text(`f′(a) = ${fmt(m)}`, 150, 140, { size: 24, color: col, align: "left", alpha: d.fade(t, 1.5) });

      const F = d.fade(t, 10.3);
      for (const x of FLAT) {
        d.circle(P.X(x), P.Y(f(x)), 14, { color: COLORS.green, alpha: F });
      }
      d.text("flat: f′ = 0", P.X(FLAT[0]), P.Y(f(FLAT[0])) - 26, { size: 16, color: COLORS.green, align: "center", alpha: F });
    },
  },
]);

// The derivative as the slope of a tangent line sliding along a curve.
import { defineVideo, COLORS } from "eigencast/draw";

const F = (x) => x * x;
const DF = (x) => 2 * x;

const X0 = -2.4;
const X1 = 2.4;
const Y0 = -1;
const Y1 = 5.6;

// Part of the tangent at x that stays inside the plot's y range.
function tangentRange(x) {
  const y = F(x);
  const m = DF(x);
  if (Math.abs(m) < 1e-6) {
    return y >= Y0 && y <= Y1 ? [X0, X1] : null;
  }
  const a = x + (Y0 - y) / m;
  const b = x + (Y1 - y) / m;
  const lo = Math.max(X0, Math.min(a, b));
  const hi = Math.min(X1, Math.max(a, b));
  return hi - lo > 0.05 ? [lo, hi] : null;
}

function frame(d, t) {
  const P = d.plot({ x: 110, y: 120, w: 600, h: 320, xRange: [X0, X1], yRange: [Y0, Y1] });
  d.axes(P, {
    xTicks: [-2, -1, 0, 1, 2],
    yTicks: [0, 2, 4],
    xLabel: "x",
    yLabel: "f(x)",
    alpha: d.fade(t, 0, 1),
  });
  d.curve(P, F, {
    color: COLORS.blue,
    width: 3,
    to: d.lerp(X0, X1, d.fade(t, 0.2, 2.2)),
  });
  return P;
}

function tangentAt(d, P, x, alpha) {
  const seg = tangentRange(x);
  if (!seg || alpha <= 0) return;
  const y = F(x);
  const m = DF(x);
  d.curve(P, (xx) => y + m * (xx - x), {
    from: seg[0],
    to: seg[1],
    color: COLORS.yellow,
    width: 3,
    alpha,
  });
}

function pointAt(d, P, x, alpha) {
  const y = F(x);
  d.line(P.X(x), P.Y(0), P.X(x), P.Y(y), {
    color: COLORS.muted,
    width: 1.5,
    dash: [5, 5],
    alpha: alpha * 0.55,
  });
  d.dot(P.X(x), P.Y(y), 7, { color: COLORS.ink, alpha });
}

function slopePanel(d, { x, slope, alpha, showX }) {
  const bx = 760;
  d.text("slope at this point", bx, 150, { size: 14, color: COLORS.muted, alpha });
  d.text(slope.toFixed(2), bx, 205, { size: 40, color: COLORS.yellow, weight: 700, alpha });

  const ax0 = bx;
  const ax1 = bx + 130;
  const ay = 250;
  d.line(ax0, ay, ax1, ay, { color: COLORS.muted, width: 2, alpha: alpha * 0.8 });
  const zx = (ax0 + ax1) / 2;
  d.line(zx, ay - 7, zx, ay + 7, { color: COLORS.muted, width: 1.5, alpha: alpha * 0.8 });
  d.text("negative", ax0, ay + 26, { size: 12, color: COLORS.muted, align: "left", alpha });
  d.text("positive", ax1, ay + 26, { size: 12, color: COLORS.muted, align: "right", alpha });

  const sx = ax0 + ((d.clamp(slope, -4, 4) + 4) / 8) * (ax1 - ax0);
  d.dot(sx, ay, 7, { color: COLORS.yellow, alpha });

  if (showX) {
    const xs = Math.abs(x - Math.round(x)) < 0.005 ? String(Math.round(x)) : x.toFixed(2);
    d.text(`x₀ = ${xs}`, bx, 336, { size: 18, color: COLORS.ink, alpha });
  }
}

export default defineVideo([
  {
    name: "A tangent at one point",
    dur: 14,
    beats: [
      [0, "IDEA", "A curve, and one point on it."],
      [4.8, "DEFINITION", "The derivative is the slope of the tangent there."],
      [9.4, "EXAMPLE", "At x = 1, the slope is 2."],
    ],
    draw(t, d) {
      const P = frame(d, t);
      const x = 1;
      const aPt = d.fade(t, 1.8, 0.8);
      pointAt(d, P, x, aPt);
      d.text("x₀", P.X(x), P.Y(0) + 24, {
        size: 16,
        color: COLORS.ink,
        align: "center",
        alpha: aPt,
      });

      const aT = d.fade(t, 5.0, 1.0);
      tangentAt(d, P, x, aT);

      // Rise of 2 per run of 1, drawn on the right of the point.
      const aTri = d.fade(t, 10.2, 0.9);
      if (aTri > 0) {
        const y = F(x);
        d.line(P.X(x), P.Y(y), P.X(x + 1), P.Y(y), {
          color: COLORS.green,
          width: 2,
          dash: [5, 4],
          alpha: aTri,
        });
        d.line(P.X(x + 1), P.Y(y), P.X(x + 1), P.Y(y + 2), {
          color: COLORS.green,
          width: 2,
          dash: [5, 4],
          alpha: aTri,
        });
        d.text("1", (P.X(x) + P.X(x + 1)) / 2, P.Y(y) + 22, {
          size: 15,
          color: COLORS.green,
          align: "center",
          alpha: aTri,
        });
        d.text("2", P.X(x + 1) + 8, P.Y(y + 1) + 5, {
          size: 15,
          color: COLORS.green,
          align: "left",
          alpha: aTri,
        });
      }

      slopePanel(d, {
        x,
        slope: DF(x),
        alpha: d.fade(t, 5.0, 0.8),
        showX: d.fade(t, 9.4) > 0,
      });
    },
  },
  {
    name: "The tangent slides",
    dur: 14,
    beats: [
      [0, "SLIDE", "Move the point; the tangent follows."],
      [4.5, "SIGN", "Negative, zero, then positive."],
      [9.5, "RESULT", "The derivative: the slope at every point."],
    ],
    draw(t, d) {
      const P = frame(d, t);
      const u = d.ease(d.prog(t, 0.5, 12.0));
      const x = d.lerp(-2, 2, u);
      const m = DF(x);

      pointAt(d, P, x, d.fade(t, 0.3, 0.6));
      tangentAt(d, P, x, d.fade(t, 0.6, 0.8));

      slopePanel(d, {
        x,
        slope: m,
        alpha: d.fade(t, 0.5, 0.8),
        showX: true,
      });
    },
  },
]);

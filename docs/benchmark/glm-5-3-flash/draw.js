// Derivative explainer: the slope of the tangent line, shown sliding along a curve.
import { defineVideo, COLORS } from "eigencast/draw";

// Curve and its exact derivative (shared by both scenes)
const f = (x) => (-x * x) / 6 + x + 0.5;
const fp = (x) => 1 - x / 3;
const XR = [0, 6];
const YR = [0, 5];
const A0 = 1.6; // fixed point used in scene 0

// x-interval where the tangent at a stays inside the y range
function tangentRange(a) {
  const m = fp(a);
  const b = f(a) - m * a;
  let x0 = XR[0];
  let x1 = XR[1];
  if (m > 1e-6) {
    x0 = Math.max(x0, (YR[0] - b) / m);
    x1 = Math.min(x1, (YR[1] - b) / m);
  } else if (m < -1e-6) {
    x0 = Math.max(x0, (YR[1] - b) / m);
    x1 = Math.min(x1, (YR[0] - b) / m);
  }
  return [x0, x1];
}

function drawCurve(t, d, fa) {
  const P = d.plot({ x: 140, y: 130, w: 540, h: 350, xRange: XR, yRange: YR });
  d.axes(P, { xTicks: [1, 3, 5], yTicks: [1, 3, 5], xLabel: "x", yLabel: "y", alpha: d.fade(t, 0, 0.8) });
  d.curve(P, f, {
    color: COLORS.ink,
    width: 3,
    to: d.lerp(XR[0], XR[1], d.ease(d.prog(t, 0.2, fa))),
  });
  return P;
}

function drawTangent(P, d, a, alpha) {
  const [cx0, cx1] = tangentRange(a);
  d.line(P.X(cx0), P.Y(f(a) + fp(a) * (cx0 - a)), P.X(cx1), P.Y(f(a) + fp(a) * (cx1 - a)), {
    color: COLORS.yellow,
    width: 2.5,
    alpha,
  });
  d.dot(P.X(a), P.Y(f(a)), 7, { color: COLORS.red, alpha });
}

export default defineVideo([
  {
    name: "The derivative is a slope",
    dur: 11,
    beats: [
      [0, "IDEA", "y = f(x) — how fast does it change?"],
      [5.5, "RESULT", "f′(a) = slope of the tangent line"],
    ],
    draw(t, d) {
      const P = drawCurve(t, d, 2.6);
      d.text("y = f(x)", P.X(4.8), P.Y(f(4.8)) - 26, { size: 20, color: COLORS.muted, alpha: d.fade(t, 2.6) });

      // fixed point on the curve
      const pa = d.fade(t, 3.2, 0.6);
      d.dot(P.X(A0), P.Y(f(A0)), 7, { color: COLORS.red, alpha: pa });
      d.text("a", P.X(A0), P.Y(f(A0)) + 30, { size: 18, color: COLORS.red, align: "center", alpha: pa });

      // tangent line fades in
      const pt = d.fade(t, 5.7, 0.8);
      drawTangent(P, d, A0, pt * (1 - pa) + pa * pt);
      d.text(`slope at a = f′(a) = ${fp(A0).toFixed(2)}`, 880, 170, {
        size: 20,
        color: COLORS.yellow,
        align: "right",
        alpha: d.fade(t, 6.6),
      });
      d.text("just grazes the curve", 880, 202, {
        size: 16,
        color: COLORS.muted,
        align: "right",
        alpha: d.fade(t, 7.4),
      });
    },
  },
  {
    name: "Sliding along the curve",
    dur: 12,
    beats: [
      [0, "EXAMPLE", "The tangent slides — slope changes point to point"],
      [5.2, "RESULT", "f′(x): a function whose value is the slope"],
    ],
    draw(t, d) {
      const P = drawCurve(t, d, 1.0);
      // point slides there and back over the whole scene
      const a = d.lerp(0.7, 5.3, 0.5 - 0.45 * Math.cos(Math.PI * d.prog(t, 0.3, 10.8)));
      drawTangent(P, d, a, d.fade(t, 0.4));

      d.text(`f′(x) = ${fp(a).toFixed(2)}`, 880, 170, {
        size: 24,
        color: COLORS.yellow,
        align: "right",
        alpha: d.fade(t, 0.8),
      });

      // fixed slope marks along the curve fade in with the "function" idea
      const marks = d.fade(t, 5.4);
      for (const x of [0.75, 1.5, 2.25, 3, 3.75, 4.5, 5.25]) {
        d.line(P.X(x - 0.25), P.Y(f(x) - 0.25 * fp(x)), P.X(x + 0.25), P.Y(f(x) + 0.25 * fp(x)), {
          color: COLORS.teal,
          width: 2,
          alpha: marks * 0.9,
        });
      }

      d.text("every x,", 880, 240, { size: 18, color: COLORS.teal, align: "right", alpha: marks });
      d.text("its own slope", 880, 268, { size: 18, color: COLORS.teal, align: "right", alpha: marks });
    },
  },
]);

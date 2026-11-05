import { defineVideo, COLORS } from "eigencast/draw";

const f = (x) => 0.16 * (x - 4) ** 2 + 1.1;
const slopeAt = (x) => 0.32 * (x - 4);

function makePlot(d) {
  return d.plot({ x: 100, y: 120, w: 760, h: 320, xRange: [0, 8], yRange: [0, 4.5] });
}

function drawCurve(P, d, t) {
  d.axes(P, {
    xTicks: [0, 2, 4, 6, 8],
    yTicks: [0, 2, 4],
    xLabel: "x",
    yLabel: "f(x)",
    alpha: d.fade(t, 0),
  });
  d.curve(P, f, {
    color: COLORS.blue,
    width: 3,
    to: d.lerp(0, 8, d.fade(t, 0.25, 2.4)),
  });
}

function drawTangent(P, d, x, alpha, showGuide = false) {
  const y = f(x);
  const m = slopeAt(x);
  const x1 = Math.max(0, x - 2.2);
  const x2 = Math.min(8, x + 2.2);

  d.line(P.X(x1), P.Y(y + m * (x1 - x)), P.X(x2), P.Y(y + m * (x2 - x)), {
    color: COLORS.yellow,
    width: 3,
    alpha,
  });
  if (showGuide) {
    d.line(P.X(x), P.Y(y), P.X(x), P.Y(0), {
      color: COLORS.muted,
      width: 1.5,
      dash: [5, 5],
      alpha: alpha * 0.65,
    });
  }
  d.dot(P.X(x), P.Y(y), 6, { color: COLORS.yellow, alpha });
}

export default defineVideo([
  {
    name: "A slope at one point",
    dur: 15,
    beats: [
      [0, "IDEA", "A function draws a curve, whose steepness can change."],
      [4.5, "EXAMPLE", "At one point, draw the line that just touches the curve."],
      [9.5, "RESULT", "The tangent's slope is the instantaneous rate of change."],
    ],
    draw(t, d) {
      const P = makePlot(d);
      drawCurve(P, d, t);

      const tangentAlpha = d.fade(t, 4.7, 0.7);
      drawTangent(P, d, 2.5, tangentAlpha);
      d.text("f′(a)", 830, 155, {
        size: 25,
        color: COLORS.yellow,
        align: "right",
        alpha: d.fade(t, 9.5, 0.7),
      });
    },
  },
  {
    name: "The derivative moves with it",
    dur: 15,
    beats: [
      [0, "EXAMPLE", "Slide the touching point; the tangent pivots with the curve."],
      [5, "IDEA", "At each position, the slope can be different."],
      [9.5, "RESULT", "The derivative is the tangent line's slope at x."],
    ],
    draw(t, d) {
      const P = makePlot(d);
      drawCurve(P, d, t);

      const u = d.ease(d.prog(t, 0.5, 14.5));
      const x = d.lerp(1, 7, u);
      const alpha = d.fade(t, 0.5, 0.6);
      drawTangent(P, d, x, alpha, true);
      d.text(`f′(x) = ${slopeAt(x).toFixed(1)}`, 840, 155, {
        size: 23,
        color: COLORS.yellow,
        align: "right",
        alpha,
      });
    },
  },
]);

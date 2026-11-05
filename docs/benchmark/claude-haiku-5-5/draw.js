// The derivative as the slope of a tangent line, sliding along a curve.
import { defineVideo, COLORS } from "eigencast/draw";

const f = (x) => 0.3 * x * x + 1;
const fp = (x) => 0.6 * x;

export default defineVideo([
  {
    name: "The slope at one point",
    dur: 20,
    beats: [
      [0, "IDEA", "The derivative gives the slope of a curve at one exact point."],
      [6, "EXAMPLE", "The tangent line just touches the curve. Slide the point, and it slides too."],
    ],
    draw(t, d) {
      const P = d.plot({ x: 120, y: 100, w: 720, h: 340, xRange: [-5, 5], yRange: [0, 10] });
      d.axes(P, { xTicks: [-5, 0, 5], yTicks: [0, 5, 10], xLabel: "x", yLabel: "y", alpha: d.fade(t, 0) });
      d.curve(P, f, { color: COLORS.blue, to: d.lerp(-5, 5, d.fade(t, 0.5, 2.5)) });
      const a = d.lerp(-3, 3, d.ease(d.prog(t, 7, 19)));
      const x1 = a - 2;
      const x2 = a + 2;
      const alpha = d.fade(t, 6);
      d.line(P.X(x1), P.Y(f(a) + fp(a) * (x1 - a)), P.X(x2), P.Y(f(a) + fp(a) * (x2 - a)), {
        color: COLORS.yellow,
        width: 3,
        alpha,
      });
      d.dot(P.X(a), P.Y(f(a)), 6, { color: COLORS.yellow, alpha });
    },
  },
  {
    name: "Slope at every point",
    dur: 20,
    beats: [
      [0, "RESULT", "For this curve, the slope at any x is 0.6 times x."],
      [8, "RESULT", "So it is negative on the left, zero at the bottom, and positive on the right."],
      [14, "OVERVIEW", "That rule for every slope is the derivative of the function."],
    ],
    draw(t, d) {
      const P = d.plot({ x: 120, y: 100, w: 720, h: 340, xRange: [-5, 5], yRange: [0, 10] });
      d.axes(P, { xTicks: [-5, 0, 5], yTicks: [0, 5, 10], xLabel: "x", yLabel: "y", alpha: d.fade(t, 0) });
      d.curve(P, f, { color: COLORS.blue });
      const a = d.lerp(-3, 3, d.ease(d.prog(t, 0, 18)));
      const x1 = a - 2;
      const x2 = a + 2;
      d.line(P.X(x1), P.Y(f(a) + fp(a) * (x1 - a)), P.X(x2), P.Y(f(a) + fp(a) * (x2 - a)), {
        color: COLORS.yellow,
        width: 3,
      });
      d.dot(P.X(a), P.Y(f(a)), 6, { color: COLORS.yellow });
      d.text(`x = ${a.toFixed(2)}     slope = ${fp(a).toFixed(2)}`, 860, 130, {
        size: 22,
        color: COLORS.yellow,
        align: "right",
      });
    },
  },
]);

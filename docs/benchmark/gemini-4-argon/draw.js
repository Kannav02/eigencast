import { defineVideo, COLORS } from "eigencast/draw";

// Scene 0 function: f(x) = 0.22 * x^2 + 0.6
const f0 = (x) => 0.22 * x * x + 0.6;
const df0 = (x) => 0.44 * x;

// Scene 1 function: arch with a clear peak at x = 2.5
const f1 = (x) => -0.36 * (x - 2.5) * (x - 2.5) + 3.8;
const df1 = (x) => -0.72 * (x - 2.5);

function slopeColor(m) {
  if (m > 0.06) return COLORS.green;
  if (m < -0.06) return COLORS.red;
  return COLORS.yellow;
}

function fmtSigned(v) {
  if (Math.abs(v) < 0.005) return "0.00";
  return (v > 0 ? "+" : "") + v.toFixed(2);
}

export default defineVideo([
  {
    name: "Slope at a Point",
    dur: 18,
    beats: [
      [0, "PROBLEM", "A curve's steepness changes from point to point."],
      [6, "IDEA", "The tangent line matches the curve's direction at one point."],
      [12, "RESULT", "The derivative f'(x) is the slope of that tangent line."],
    ],
    draw(t, d) {
      const P = d.plot({ x: 85, y: 115, w: 460, h: 350, xRange: [0, 5], yRange: [0, 5] });
      d.axes(P, {
        xTicks: [0, 1, 2, 3, 4, 5],
        yTicks: [0, 1, 2, 3, 4, 5],
        xLabel: "x",
        yLabel: "y",
        alpha: d.fade(t, 0, 0.6),
      });

      // Draw main curve f(x)
      const curveEnd = d.lerp(0.3, 4.4, d.ease(d.prog(t, 0.3, 2.2)));
      d.curve(P, f0, {
        color: COLORS.blue,
        width: 3,
        from: 0.3,
        to: curveEnd,
        alpha: d.fade(t, 0.2, 0.4),
      });
      d.text("f(x)", P.X(4.4) + 10, P.Y(f0(4.4)) + 4, {
        size: 18,
        color: COLORS.blue,
        weight: 700,
        align: "left",
        alpha: d.fade(t, 2.0, 0.5),
      });

      // Point x0 slides along curve during beat 0 (t: 2.3 -> 5.6), then settles at x0 = 2.5 for beats 1 & 2
      const sweepU = d.ease(d.prog(t, 2.3, 5.5));
      const settleU = d.ease(d.prog(t, 5.8, 6.8));
      const xSweep = d.lerp(1.1, 3.6, sweepU);
      const x0 = t < 5.8 ? xSweep : d.lerp(3.6, 2.5, settleU);
      const y0 = f0(x0);
      const m0 = df0(x0);

      const ptAlpha = d.fade(t, 2.2, 0.5);
      if (ptAlpha > 0) {
        // Short tangent segment in beat 0, expanding into full tangent line in beat 1
        const halfSpan = d.lerp(0.65, 1.45, d.ease(d.prog(t, 6.0, 7.2)));
        const xA = d.clamp(x0 - halfSpan, 0.2, 4.8);
        const xB = d.clamp(x0 + halfSpan, 0.2, 4.8);
        const yA = y0 + m0 * (xA - x0);
        const yB = y0 + m0 * (xB - x0);

        d.line(P.X(xA), P.Y(yA), P.X(xB), P.Y(yB), {
          color: COLORS.yellow,
          width: 2.5,
          alpha: ptAlpha,
        });

        // Dashed coordinate drop line
        d.line(P.X(x0), P.Y(0), P.X(x0), P.Y(y0), {
          color: COLORS.muted,
          width: 1.5,
          dash: [5, 4],
          alpha: ptAlpha * 0.7,
        });

        d.dot(P.X(x0), P.Y(y0), 5.5, { color: COLORS.yellow, alpha: ptAlpha });

        // Live steepness label during beat 0
        const b0LabelAlpha = ptAlpha * (1 - d.fade(t, 5.8, 0.4));
        if (b0LabelAlpha > 0.01) {
          d.text(`slope = ${m0.toFixed(2)}`, P.X(x0) - 14, P.Y(y0) - 18, {
            size: 16,
            color: COLORS.yellow,
            align: "right",
            alpha: b0LabelAlpha,
          });
        }
      }

      // Beat 1: Rise-over-run triangle and tangent label at x0 = 2.5
      const triAlpha = d.fade(t, 7.2, 0.7);
      if (triAlpha > 0) {
        const run = 1.0;
        const rise = m0 * run;
        const x1 = x0 + run;
        const y1 = y0 + rise;

        // Horizontal run segment
        d.line(P.X(x0), P.Y(y0), P.X(x1), P.Y(y0), {
          color: COLORS.teal,
          width: 2,
          dash: [4, 3],
          alpha: triAlpha,
        });
        // Vertical rise segment
        d.line(P.X(x1), P.Y(y0), P.X(x1), P.Y(y1), {
          color: COLORS.green,
          width: 2.5,
          alpha: triAlpha,
        });

        d.text("Δx = 1", P.X(x0 + 0.5), P.Y(y0) + 20, {
          size: 15,
          color: COLORS.teal,
          align: "center",
          alpha: triAlpha,
        });
        d.text(`Δy = ${rise.toFixed(2)}`, P.X(x1) + 10, P.Y(y0 + rise * 0.5) + 5, {
          size: 15,
          color: COLORS.green,
          align: "left",
          alpha: triAlpha,
        });

        d.text("tangent line", P.X(1.25) + 14, P.Y(y0 + m0 * (1.25 - x0)) + 20, {
          size: 16,
          color: COLORS.yellow,
          align: "left",
          alpha: triAlpha,
        });
      }

      // Beat 2: Derivative definition box on the right
      const cardAlpha = d.fade(t, 12.2, 0.7);
      if (cardAlpha > 0) {
        const cx = 585;
        const cy = 135;
        const cw = 325;
        const ch = 265;

        d.rect(cx, cy, cw, ch, { color: COLORS.grid, width: 2, alpha: cardAlpha });

        d.text("DEFINITION", cx + 24, cy + 36, {
          size: 14,
          color: COLORS.muted,
          weight: 700,
          alpha: cardAlpha,
        });

        d.text("f'(x) = slope of tangent", cx + 24, cy + 76, {
          size: 22,
          color: COLORS.yellow,
          weight: 700,
          alpha: cardAlpha,
        });

        d.text("= Δy / Δx  at point x", cx + 78, cy + 110, {
          size: 18,
          color: COLORS.ink,
          alpha: cardAlpha,
        });

        d.line(cx + 24, cy + 138, cx + cw - 24, cy + 138, {
          color: COLORS.grid,
          width: 1.5,
          alpha: cardAlpha,
        });

        const valAlpha = d.fade(t, 13.4, 0.7);
        d.text("At x = 2.5:", cx + 24, cy + 175, {
          size: 16,
          color: COLORS.muted,
          alpha: valAlpha,
        });

        d.text("f'(2.5) = +1.10", cx + 24, cy + 215, {
          size: 26,
          color: COLORS.green,
          weight: 700,
          alpha: valAlpha,
        });

        d.text("instantaneous rate of change", cx + 24, cy + 245, {
          size: 14,
          color: COLORS.muted,
          italic: true,
          alpha: valAlpha,
        });
      }
    },
  },
  {
    name: "Sliding the Tangent Line",
    dur: 18,
    beats: [
      [0, "EXAMPLE", "Climbing curve: tangent tilts up, so f'(x) > 0."],
      [6, "IDEA", "At the peak: tangent is horizontal, so f'(x) = 0."],
      [12, "RESULT", "Falling curve: tangent tilts down, tracing the full derivative f'(x)."],
    ],
    draw(t, d) {
      const P1 = d.plot({ x: 75, y: 135, w: 375, h: 330, xRange: [0, 5], yRange: [0, 5] });
      const P2 = d.plot({ x: 535, y: 135, w: 375, h: 330, xRange: [0, 5], yRange: [-2, 2] });

      const baseAlpha = d.fade(t, 0, 0.5);

      // Panel headers
      d.text("Function  y = f(x)", 262, 105, {
        size: 18,
        color: COLORS.blue,
        weight: 700,
        align: "center",
        alpha: baseAlpha,
      });
      d.text("Derivative  y = f'(x)", 722, 105, {
        size: 18,
        color: COLORS.yellow,
        weight: 700,
        align: "center",
        alpha: baseAlpha,
      });

      d.axes(P1, {
        xTicks: [0, 1, 2, 3, 4, 5],
        yTicks: [0, 1, 2, 3, 4, 5],
        xLabel: "x",
        yLabel: "f(x)",
        alpha: baseAlpha,
      });
      d.axes(P2, {
        xTicks: [0, 1, 2, 3, 4, 5],
        yTicks: [-2, -1, 0, 1, 2],
        xLabel: "x",
        yLabel: "f'(x)",
        alpha: baseAlpha,
      });

      // Zero-slope reference line on P2
      d.line(P2.X(0), P2.Y(0), P2.X(5), P2.Y(0), {
        color: COLORS.grid,
        width: 1.5,
        dash: [5, 4],
        alpha: baseAlpha,
      });

      // Draw f(x) on left plot
      d.curve(P1, f1, {
        color: COLORS.blue,
        width: 3,
        from: 0.4,
        to: 4.6,
        alpha: baseAlpha,
      });

      // Compute sliding x position synchronized with the 3 beats:
      // Beat 0 (0..6): slides up the climbing left side from x = 0.6 to x = 2.0
      // Beat 1 (6..12): slides to the peak at x = 2.5 and pauses there
      // Beat 2 (12..18): slides down the falling right side from x = 2.5 to x = 4.4
      let xPos = 0.6;
      if (t < 6) {
        xPos = d.lerp(0.6, 2.0, d.ease(d.prog(t, 0.4, 5.4)));
      } else if (t < 12) {
        xPos = d.lerp(2.0, 2.5, d.ease(d.prog(t, 6.0, 8.2)));
      } else {
        xPos = d.lerp(2.5, 4.4, d.ease(d.prog(t, 12.2, 16.8)));
      }

      const yPos = f1(xPos);
      const mPos = df1(xPos);
      const sCol = slopeColor(mPos);

      // Sliding tangent line on P1
      const dx = 0.85;
      const xL = d.clamp(xPos - dx, 0.2, 4.8);
      const xR = d.clamp(xPos + dx, 0.2, 4.8);
      d.line(
        P1.X(xL),
        P1.Y(yPos + mPos * (xL - xPos)),
        P1.X(xR),
        P1.Y(yPos + mPos * (xR - xPos)),
        { color: sCol, width: 3, alpha: baseAlpha }
      );

      // Dashed vertical drop line on P1
      d.line(P1.X(xPos), P1.Y(0), P1.X(xPos), P1.Y(yPos), {
        color: COLORS.muted,
        width: 1.5,
        dash: [4, 4],
        alpha: baseAlpha * 0.65,
      });

      d.dot(P1.X(xPos), P1.Y(yPos), 5.5, { color: sCol, alpha: baseAlpha });

      // Live slope readout inside P1 top-right
      d.text(`slope = ${fmtSigned(mPos)}`, P1.X(4.85), P1.Y(4.7), {
        size: 17,
        color: sCol,
        weight: 700,
        align: "right",
        alpha: baseAlpha,
      });

      // Trace the derivative curve f'(x) on P2 up to xPos
      if (xPos > 0.61) {
        d.curve(P2, df1, {
          color: COLORS.yellow,
          width: 3,
          from: 0.6,
          to: xPos,
          alpha: baseAlpha,
        });
      }

      // Vertical bar from y = 0 to f'(xPos) on P2
      d.line(P2.X(xPos), P2.Y(0), P2.X(xPos), P2.Y(mPos), {
        color: sCol,
        width: 2,
        dash: [4, 3],
        alpha: baseAlpha * 0.85,
      });

      d.dot(P2.X(xPos), P2.Y(mPos), 5.5, { color: sCol, alpha: baseAlpha });

      // Regime annotations on P2
      const posAlpha = d.fade(t, 1.2, 0.6);
      d.text("f'(x) > 0  (climbing)", P2.X(0.7), P2.Y(1.65), {
        size: 15,
        color: COLORS.green,
        align: "left",
        alpha: posAlpha,
      });

      const zeroAlpha = d.fade(t, 7.6, 0.6);
      d.dot(P2.X(2.5), P2.Y(0), 4.5, { color: COLORS.yellow, alpha: zeroAlpha });
      d.text("peak: f'(x) = 0", P2.X(2.65), P2.Y(0.32), {
        size: 15,
        color: COLORS.yellow,
        align: "left",
        alpha: zeroAlpha,
      });

      const negAlpha = d.fade(t, 13.5, 0.6);
      d.text("f'(x) < 0  (falling)", P2.X(0.7), P2.Y(-1.45), {
        size: 15,
        color: COLORS.red,
        align: "left",
        alpha: negAlpha,
      });
    },
  },
]);

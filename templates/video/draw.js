// Starter video. Each scene: a name, a design length in seconds, its beats, and draw(t, d).
// A beat is [start time in the scene, phase label, on-screen caption]. Beat ids are s<scene>b<beat>:
// the first beat below is s0b0, and its spoken words live under "s0b0" in script.json.
// The narration's real length stretches each beat, so design times only set the pacing inside it.
import { defineVideo, COLORS } from "eigencast/draw";

export default defineVideo([
  {
    name: "A straight line",
    dur: 10,
    beats: [
      [0, "IDEA", "A line is described by y = m·x + b."],
      [5, "EXAMPLE", "Changing m tilts the line."],
    ],
    draw(t, d) {
      const P = d.plot({ x: 120, y: 100, w: 720, h: 340, xRange: [0, 10], yRange: [0, 10] });
      d.axes(P, { xTicks: [0, 5, 10], yTicks: [0, 5, 10], xLabel: "x", yLabel: "y", alpha: d.fade(t, 0) });
      const m = 0.5 + 0.5 * d.ease(d.prog(t, 5, 9)); // slope animates from 0.5 to 1 during the second beat
      d.curve(P, (x) => m * x + 1, { color: COLORS.blue, to: d.lerp(0, 10, d.fade(t, 0.5, 2.5)) });
      d.text(`m = ${m.toFixed(2)}`, 860, 130, { size: 22, color: COLORS.yellow, align: "right", alpha: d.fade(t, 5) });
    },
  },
]);

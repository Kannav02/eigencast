import { loadFont as loadDisplay } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadBody } from "@remotion/google-fonts/SourceSerif4";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

/** Shared palette for every animation: dark "screening room" stage. */
export const COLORS = {
  stage: "#121d2a",
  panel: "#172434",
  ink: "#e6edf3",
  muted: "#8b9db0",
  grid: "#26384b",
  major: "#7fb0d1",
  rare: "#f08a4b",
  gold: "#e3c065",
  good: "#6cc391",
} as const;

/** Caption chip color per narration phase. */
export const PHASE_COLORS: Record<string, string> = {
  SCORE: COLORS.major,
  LOSS: COLORS.gold,
  WALL: COLORS.rare,
  FIX: COLORS.good,
  OVERVIEW: COLORS.muted,
};

const display = loadDisplay("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const body = loadBody("normal", { weights: ["400", "600"], subsets: ["latin", "latin-ext"] });
const mono = loadMono("normal", { weights: ["400", "600"], subsets: ["latin", "latin-ext", "greek"] });

/** CSS font stacks, usable in both DOM styles and canvas `ctx.font`. */
export const FONTS = {
  display: `'${display.fontFamily}', Arial, sans-serif`,
  body: `'${body.fontFamily}', Georgia, serif`,
  mono: `'${mono.fontFamily}', Menlo, monospace`,
};

/** Resolves once every font file has loaded (canvas text needs this before drawing). */
export const fontsLoaded: Promise<unknown> = Promise.all([
  display.waitUntilDone(),
  body.waitUntilDone(),
  mono.waitUntilDone(),
]);

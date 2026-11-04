import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/**
 * House style: Manim's palette (the library behind 3Blue1Brown) on pure black,
 * with Computer Modern (CMU Serif) for all text. Hex values are Manim's own constants.
 */
export const COLORS = {
  stage: "#000000", // BLACK
  panel: "#000000", // no filled cards; shapes are outlines on black
  ink: "#FFFFFF", // WHITE: text, axes, main curves
  muted: "#BBBBBB", // GREY_B: labels, secondary text
  grid: "#236B8E", // BLUE_E: faint background lines
  major: "#58C4DD", // BLUE_C: class 0 / majority
  rare: "#FC6255", // RED_C: class 1 / rare, and walls
  gold: "#F7D96F", // YELLOW_C: losses and highlights
  good: "#83C167", // GREEN_C: fixes
} as const;

/** Phase label color per narration phase. */
export const PHASE_COLORS: Record<string, string> = {
  SCORE: COLORS.major,
  LOSS: COLORS.gold,
  WALL: COLORS.rare,
  FIX: COLORS.good,
  OVERVIEW: COLORS.muted,
};

const FAMILY = "CMU Serif";
const FACES: [file: string, weight: string, style: string][] = [
  ["cmu-serif-500-roman.woff2", "500", "normal"],
  ["cmu-serif-700-roman.woff2", "700", "normal"],
  ["cmu-serif-500-italic.woff2", "500", "italic"],
];

/** Resolves once every font file has loaded (canvas text needs this before drawing). */
export const fontsLoaded: Promise<unknown> = Promise.all(
  FACES.map(([file, weight, style]) => loadFont({ family: FAMILY, url: staticFile(`fonts/${file}`), weight, style })),
);

const SERIF = `'${FAMILY}', 'Latin Modern Roman', Georgia, serif`;

/** Font stacks, usable in both DOM styles and canvas `ctx.font`. All roles use Computer Modern. */
export const FONTS = { display: SERIF, body: SERIF, mono: SERIF };

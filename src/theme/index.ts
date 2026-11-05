/**
 * House style: Manim's palette on pure black, with Computer Modern (CMU Serif) for all text.
 * Hex values are Manim's own constants. Plain constants only, so this module also loads
 * outside the browser (the CLI imports draw files to check them).
 */
export const COLORS = {
  stage: "#000000", // BLACK
  panel: "#000000", // no filled cards; shapes are outlines on black
  ink: "#FFFFFF", // WHITE: text, axes, main curves
  muted: "#BBBBBB", // GREY_B: labels, secondary text
  grid: "#236B8E", // BLUE_E: faint background lines
  major: "#58C4DD", // BLUE_C
  rare: "#FC6255", // RED_C
  gold: "#F7D96F", // YELLOW_C
  good: "#83C167", // GREEN_C
  blue: "#58C4DD",
  red: "#FC6255",
  yellow: "#F7D96F",
  green: "#83C167",
  purple: "#9A72AC", // PURPLE_C
  teal: "#5CD0B3", // TEAL_C
  orange: "#FF862F", // ORANGE
} as const;

/** Phase label color per narration phase. Unknown phases fall back to muted grey. */
export const PHASE_COLORS: Record<string, string> = {
  SCORE: COLORS.blue,
  LOSS: COLORS.yellow,
  WALL: COLORS.red,
  FIX: COLORS.green,
  OVERVIEW: COLORS.muted,
  IDEA: COLORS.blue,
  EXAMPLE: COLORS.yellow,
  PROBLEM: COLORS.red,
  RESULT: COLORS.green,
};

export const FONT_FAMILY = "CMU Serif";
const SERIF = `'${FONT_FAMILY}', 'Latin Modern Roman', Georgia, serif`;

/** Font stacks, usable in both DOM styles and canvas `ctx.font`. All roles use Computer Modern. */
export const FONTS = { display: SERIF, body: SERIF, mono: SERIF };

/** Computer Modern has a small x-height; canvas text sizes are multiplied by this. */
export const TEXT_SCALE = 1.12;

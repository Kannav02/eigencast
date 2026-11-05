import { loadFont } from "@remotion/fonts";
import italic500 from "../../fonts/cmu-serif-500-italic.woff2";
import roman500 from "../../fonts/cmu-serif-500-roman.woff2";
import roman700 from "../../fonts/cmu-serif-700-roman.woff2";
import { FONT_FAMILY } from "../theme";

const FACES: [url: string, weight: string, style: string][] = [
  [roman500, "500", "normal"],
  [roman700, "700", "normal"],
  [italic500, "500", "italic"],
];

let loading: Promise<unknown> | null = null;

/** Resolves once every font face has loaded (canvas text needs this before drawing). */
export function fontsLoaded(): Promise<unknown> {
  loading ??= Promise.all(FACES.map(([url, weight, style]) => loadFont({ family: FONT_FAMILY, url, weight, style })));
  return loading;
}

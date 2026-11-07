/**
 * Renders the launch video to launch/out/eigencast-launch.mp4 (or a single frame with --frame N).
 *
 *   bun launch/music.ts            # regenerate the music bed (render does this if it is missing)
 *   bun launch/render.ts           # full video
 *   bun launch/render.ts --frame 300
 *
 * Set REMOTION_CHROME to use a Chrome/Chromium binary you already have instead of letting
 * Remotion download one.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const root = join(import.meta.dir, "..");
const outDir = join(import.meta.dir, "out");
mkdirSync(outDir, { recursive: true });
const browserExecutable = process.env.REMOTION_CHROME || null;
if (!existsSync(join(import.meta.dir, "assets", "music.wav"))) spawnSync("bun", [join(import.meta.dir, "music.ts")], { stdio: "inherit" });

const serveUrl = await bundle({ entryPoint: join(import.meta.dir, "index.ts"), rootDir: root, outDir: join(outDir, "bundle") });
const composition = await selectComposition({ serveUrl, id: "launch", browserExecutable });

const i = process.argv.indexOf("--frame");
if (i > 0) {
  const frame = Number(process.argv[i + 1]);
  const output = join(outDir, `frame-${frame}.png`);
  await renderStill({ serveUrl, composition, frame, output, browserExecutable });
  console.log(`wrote ${output}`);
} else {
  const output = join(outDir, "eigencast-launch.mp4");
  let last = -1;
  await renderMedia({
    serveUrl, composition, codec: "h264", outputLocation: output, browserExecutable, concurrency: 2,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== last) console.log(`rendering ${(last = pct)}%`);
    },
  });
  console.log(`wrote ${output}`);
}

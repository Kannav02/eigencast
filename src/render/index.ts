/** Turning a project into pictures: bundle once, then render a still, a full mp4, or open the studio. */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { PKG_ROOT, type Project, type Video } from "../project";
import { webpackOverride, writeEntry, writeStudioConfig } from "./entry";

const require = createRequire(join(PKG_ROOT, "package.json"));

type Log = (msg: string) => void;

/**
 * Full Chrome for Testing instead of the default headless shell: the headless shell stops
 * producing animation frames on macOS while the screen is locked, which hangs unattended
 * (agent-driven) renders at "Waiting for root component to load".
 */
const chromeMode = "chrome-for-testing" as const;

/**
 * Chrome tabs rendering frames in parallel. Measured on an M4 Air (900 lineage frames):
 * 1 tab 48 s / 850 MB, 2 tabs 65 s / 1.06 GB, 4 tabs 84 s / 1.4 GB. More tabs were slower
 * and heavier, and Remotion's default (half the cores) helped freeze a 16 GB Mac.
 */
export const DEFAULT_CONCURRENCY = 1;

async function bundleProject(project: Project, log: Log): Promise<string> {
  const entryPoint = writeEntry(project);
  log("bundling...");
  return bundle({ entryPoint, webpackOverride, outDir: join(project.workDir, "bundle"), rootDir: project.root });
}

/** Forward errors from the page (e.g. an exception in a draw file) so failures say what broke. */
const browserLog = (log: Log) => ({ type, text }: { type: string; text: string }) => {
  if (type === "error" || type === "warning") log(`[browser ${type}] ${text}`);
};

async function prepare(project: Project, video: Video, log: Log) {
  await ensureBrowser({ chromeMode });
  const serveUrl = await bundleProject(project, log);
  const composition = await selectComposition({ serveUrl, id: video.slug, chromeMode, onBrowserLog: browserLog(log) });
  return { serveUrl, composition };
}

/** Render one frame to a PNG. Returns the output path and the video's total frame count. */
export async function still(project: Project, video: Video, frame: number, out: string | undefined, log: Log) {
  const { serveUrl, composition } = await prepare(project, video, log);
  if (frame < 0 || frame >= composition.durationInFrames) {
    throw new Error(`Frame ${frame} is outside the video (0 to ${composition.durationInFrames - 1}).`);
  }
  const output = out ?? join(project.root, "out", `${video.slug}-f${frame}.png`);
  mkdirSync(dirname(output), { recursive: true });
  await renderStill({ serveUrl, composition, frame, output, imageFormat: "png", chromeMode, onBrowserLog: browserLog(log) });
  return { output, totalFrames: composition.durationInFrames, fps: composition.fps };
}

/** Render the whole video to an mp4 (Remotion's bundled ffmpeg encodes it). */
export async function render(project: Project, video: Video, out: string | undefined, log: Log, concurrency = DEFAULT_CONCURRENCY) {
  const { serveUrl, composition } = await prepare(project, video, log);
  const output = out ?? join(project.root, "out", `${video.slug}.mp4`);
  mkdirSync(dirname(output), { recursive: true });
  let last = -1;
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    outputLocation: output,
    imageFormat: "jpeg",
    chromeMode,
    concurrency,
    onBrowserLog: browserLog(log),
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== last) {
        last = pct;
        log(`rendering ${pct}%`);
      }
    },
  });
  return { output, totalFrames: composition.durationInFrames, seconds: composition.durationInFrames / composition.fps };
}

/** Open Remotion Studio (live preview with a scrubber). Runs until the user stops it. */
export function preview(project: Project): Promise<number> {
  const entry = writeEntry(project);
  const config = writeStudioConfig(project);
  const cli = join(dirname(require.resolve("@remotion/cli/package.json")), "remotion-cli.js");
  // Studio has no host option and listens on every interface; the preload pins it to 127.0.0.1.
  const loopback = join(PKG_ROOT, "src", "render", "loopback.cjs");
  const child = spawn(process.execPath, ["--preload", loopback, cli, "studio", entry, "--config", config], { cwd: project.root, stdio: "inherit" });
  return new Promise((res) => child.on("exit", (code) => res(code ?? 0)));
}

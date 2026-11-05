/** Locating an eigencast project and the videos inside it. Shared by every CLI command. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Root of the installed eigencast package (holds src/, fonts/, python/, skills/, templates/). */
export const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** Version of the installed eigencast package. */
export const PKG_VERSION: string = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")).version;
export const CONFIG_FILE = "eigencast.json";
const DRAW_FILES = ["draw.ts", "draw.js", "draw.mjs"];

export type ProjectConfig = { fps: number };
export type Project = { root: string; config: ProjectConfig; videosDir: string; workDir: string };
export type Video = {
  slug: string;
  dir: string;
  drawFile: string | null;
  scriptFile: string;
  timingFile: string;
  audioDir: string;
};

export class UserError extends Error {}

/** Walk up from `start` to the nearest folder holding eigencast.json. */
export function findProject(start = process.cwd()): Project {
  let dir = resolve(start);
  while (true) {
    const cfg = join(dir, CONFIG_FILE);
    if (existsSync(cfg)) {
      const config = { fps: 30, ...JSON.parse(readFileSync(cfg, "utf8")) } as ProjectConfig;
      return { root: dir, config, videosDir: join(dir, "videos"), workDir: join(dir, ".eigencast") };
    }
    const up = dirname(dir);
    if (up === dir) throw new UserError(`No ${CONFIG_FILE} found here or in any parent folder. Run \`eigencast init <folder>\` first.`);
    dir = up;
  }
}

export function videoAt(project: Project, slug: string): Video {
  const dir = join(project.videosDir, slug);
  const drawName = DRAW_FILES.find((f) => existsSync(join(dir, f)));
  return {
    slug,
    dir,
    drawFile: drawName ? join(dir, drawName) : null,
    scriptFile: join(dir, "script.json"),
    timingFile: join(dir, "timing.json"),
    audioDir: join(dir, "audio"),
  };
}

/** Every folder under videos/ that has a draw file. */
export function listVideos(project: Project): Video[] {
  if (!existsSync(project.videosDir)) return [];
  return readdirSync(project.videosDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => videoAt(project, e.name))
    .filter((v) => v.drawFile)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** The named video, or a UserError listing the ones that exist. */
export function requireVideo(project: Project, slug: string | undefined): Video {
  const all = listVideos(project);
  const names = all.map((v) => v.slug).join(", ") || "none yet";
  if (!slug) throw new UserError(`Name a video. Videos in this project: ${names}`);
  const v = all.find((x) => x.slug === slug);
  if (!v) throw new UserError(`No video "${slug}" (needs videos/${slug}/draw.js). Videos in this project: ${names}`);
  return v;
}

export function readJson<T>(file: string, fallback: T): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback;
}

export type Script = { voice: Record<string, unknown>; beats: Record<string, string> };
export type Timing = { beats: Record<string, { seconds: number; hash?: string }> };

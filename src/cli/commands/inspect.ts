/** `info` prints a video's timeline; `check` finds mistakes before rendering. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BEAT_ID, findProject, readJson, requireVideo, type Script, type Timing, type Video } from "../../project";
import { beatId, buildTimeline, type SceneDef } from "../../timeline";
import { runVoice } from "../../voice";
import { type Args, log } from "../args";
import { loadScenes } from "../load";

/** Code that makes frames depend on something other than the frame number. */
const NONDETERMINISM: [RegExp, string][] = [
  [/Math\.random\s*\(/, "Math.random(): use d.rng(seed) so every render draws the same frame"],
  [/Date\.now\s*\(|new Date\s*\(/, "Date: frames must depend only on t"],
  [/performance\.now\s*\(/, "performance.now(): frames must depend only on t"],
  [/setTimeout\s*\(|setInterval\s*\(|requestAnimationFrame\s*\(/, "timers: Remotion renders frames out of order; draw from t only"],
];

/**
 * Blank out comments and quoted strings, keeping line breaks, so the scan only sees code.
 * A comment like `// never call Math.random()` is then not reported.
 */
export function codeOnly(src: string): string {
  let out = "";
  let i = 0;
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  while (i < src.length) {
    const c = src[i];
    const two = src.slice(i, i + 2);
    if (two === "//") {
      const end = src.indexOf("\n", i);
      const stop = end === -1 ? src.length : end;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (two === "/*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (c === '"' || c === "'") {
      // Template literals are left alone: `${Math.random()}` inside one is still code.
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      out += c + blank(src.slice(i + 1, j)) + (src[j] === c ? c : "");
      i = src[j] === c ? j + 1 : j;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

export type Issue = { level: "error" | "warn"; where: string; message: string };

/** Build the timeline for a video as the renderer will. */
export async function timelineFor(video: Video, fps: number) {
  const scenes = await loadScenes(video);
  const timing = readJson<Timing>(video.timingFile, { beats: {} });
  return { scenes, timeline: buildTimeline(scenes, timing.beats, fps) };
}

/** Scenes' structure: positive durations, beats starting at 0 and increasing, inside the scene. */
function checkScenes(scenes: SceneDef[]): Issue[] {
  const issues: Issue[] = [];
  if (!scenes.length) issues.push({ level: "error", where: "draw", message: "no scenes" });
  scenes.forEach((s, si) => {
    const where = `scene ${si} "${s.name}"`;
    if (!(s.dur > 0)) issues.push({ level: "error", where, message: `dur must be > 0 seconds (got ${s.dur})` });
    if (!s.beats?.length) issues.push({ level: "error", where, message: "has no beats" });
    s.beats?.forEach(([t, phase, caption], bi) => {
      const id = beatId(si, bi);
      if (bi === 0 && t !== 0) issues.push({ level: "error", where: id, message: `first beat must start at 0 (got ${t})` });
      if (bi > 0 && !(t > s.beats[bi - 1][0])) issues.push({ level: "error", where: id, message: "beat times must increase" });
      if (t >= s.dur) issues.push({ level: "error", where: id, message: `starts at ${t}s, past the scene's dur ${s.dur}s` });
      if (typeof phase !== "string" || typeof caption !== "string") issues.push({ level: "error", where: id, message: "beat must be [time, phase, caption]" });
    });
  });
  return issues;
}

/**
 * Check one video.
 * 1. The draw file loads and its scenes are well formed.
 * 2. Every beat has spoken text in script.json, and script.json has no extra beats.
 * 3. The draw file has no randomness, clock or timers.
 * 4. Ask the voice step which clips are missing or out of date.
 * 5. With --listen, transcribe clips and flag ones that don't match the script.
 */
export async function check(a: Args) {
  const project = findProject();
  const video = requireVideo(project, a.positional[0]);
  const issues: Issue[] = [];
  let scenes: SceneDef[] = [];
  let loaded = false;
  try {
    scenes = await loadScenes(video);
    loaded = true;
    issues.push(...checkScenes(scenes));
  } catch (e) {
    issues.push({ level: "error", where: "draw", message: `failed to load: ${(e as Error).message}` });
  }

  let script: Script | null = null;
  try {
    script = readJson<Script | null>(video.scriptFile, null);
  } catch (e) {
    issues.push({ level: "error", where: "script.json", message: `not valid JSON: ${(e as Error).message}` });
  }
  if (!script) {
    if (!issues.some((i) => i.where === "script.json")) issues.push({ level: "error", where: "script.json", message: "missing" });
  } else if (!script.beats || typeof script.beats !== "object" || Array.isArray(script.beats)) {
    issues.push({ level: "error", where: "script.json", message: 'needs a "beats" object mapping beat ids to spoken text' });
  } else {
    const bad = Object.keys(script.beats).filter((id) => !BEAT_ID.test(id));
    if (bad.length) issues.push({ level: "error", where: "script.json", message: `beat ids must look like s0b1, got ${bad.map((b) => JSON.stringify(b)).join(", ")}` });
    if (!script.voice) issues.push({ level: "error", where: "script.json", message: 'needs a "voice" object' });
    // Comparing against the draw file only means something if it loaded; otherwise every beat would look extra.
    if (loaded) {
      const ids = new Set(scenes.flatMap((s, si) => (s.beats ?? []).map((_, bi) => beatId(si, bi))));
      for (const id of ids) if (typeof script.beats[id] !== "string" || !script.beats[id].trim()) issues.push({ level: "error", where: id, message: "no spoken text in script.json" });
      for (const id of Object.keys(script.beats)) if (BEAT_ID.test(id) && !ids.has(id)) issues.push({ level: "error", where: id, message: "in script.json but no matching beat in the draw file" });
    }
  }

  const src = codeOnly(readFileSync(video.drawFile!, "utf8"));
  src.split("\n").forEach((line, i) => {
    for (const [re, message] of NONDETERMINISM) if (re.test(line)) issues.push({ level: "error", where: `${video.drawFile!.split("/").pop()}:${i + 1}`, message });
  });

  let voice: { record: { beat: string; reason: string }[]; skip: string[]; stale: string[] } | null = null;
  if (script && !issues.some((i) => i.where === "script.json")) {
    try {
      voice = (await runVoice(["narrate", video.dir, "--plan"], log)) as typeof voice;
      for (const r of voice!.record) issues.push({ level: "warn", where: r.beat, message: `narration not recorded (${r.reason}): run \`eigencast voice ${video.slug}\`` });
    } catch (e) {
      issues.push({ level: "warn", where: "voice", message: `could not check recordings: ${(e as Error).message.split("\n")[0]}` });
    }
  }

  let listen: unknown = null;
  if (a.flags.listen) {
    listen = await runVoice(["listen", video.dir], log);
    for (const f of (listen as { flagged: { beat: string; wer: number; heard: string }[] }).flagged) {
      issues.push({ level: "warn", where: f.beat, message: `clip doesn't match the script (word error ${f.wer}); heard: "${f.heard}". Re-record with \`eigencast voice ${video.slug} --only ${f.beat}\`` });
    }
  }

  const errors = issues.filter((i) => i.level === "error").length;
  const text = issues.length
    ? issues.map((i) => `${i.level === "error" ? "ERROR" : "warn "} ${i.where}: ${i.message}`).join("\n") + `\n\n${errors} error(s), ${issues.length - errors} warning(s)`
    : `${video.slug}: all good (${scenes.length} scenes, ${scenes.reduce((n, s) => n + s.beats.length, 0)} beats, every clip recorded)`;
  return { result: { ok: errors === 0, issues, voice, listen }, text, exitCode: errors ? 1 : 0 };
}

/** Per-beat timeline: where each beat starts in the video and how long it lasts. */
export async function info(a: Args) {
  const project = findProject();
  const video = requireVideo(project, a.positional[0]);
  const { scenes, timeline } = await timelineFor(video, project.config.fps);
  const fps = project.config.fps;
  const beats = timeline.beats.map((b) => ({
    beat: b.id,
    scene: scenes[b.sceneIndex].name,
    phase: b.phase,
    startFrame: b.start,
    frames: b.frames,
    startSeconds: +(b.start / fps).toFixed(2),
    seconds: +(b.frames / fps).toFixed(2),
    middleFrame: b.start + Math.floor(b.frames / 2),
    recorded: b.hasAudio && existsSync(join(video.audioDir, `${b.id}.wav`)),
  }));
  const rows = beats.map((b) => `${b.beat.padEnd(6)} ${String(b.startFrame).padStart(6)} ${String(b.frames).padStart(6)} ${b.seconds.toFixed(2).padStart(7)}s  ${b.recorded ? "yes" : "no "}  ${b.phase.padEnd(9)} ${b.scene}`);
  const text = [`beat    start frames  length  rec  phase     scene`, ...rows, `\ntotal ${timeline.total} frames = ${(timeline.total / fps).toFixed(1)}s at ${fps} fps`].join("\n");
  return { result: { slug: video.slug, fps, totalFrames: timeline.total, seconds: +(timeline.total / fps).toFixed(2), beats }, text };
}

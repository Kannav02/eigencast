/** Commands that make sound or pictures: voice, still, render, preview. */
import { resolve } from "node:path";
import { UserError, findProject, requireVideo } from "../../project";
import { preview as openStudio, render as renderVideo, still as renderStill } from "../../render";
import { runVoice } from "../../voice";
import { type Args, flagList, flagNum, flagStr, log } from "../args";
import { timelineFor } from "./inspect";

/** Record narration for changed beats (or --force all, or --only some). */
export async function voice(a: Args) {
  const project = findProject();
  const video = requireVideo(project, a.positional[0]);
  const args = ["narrate", video.dir];
  if (a.flags.force) args.push("--force");
  const only = flagList(a, "only");
  if (only.length) args.push("--only", ...only);
  log(`recording narration for ${video.slug} (first run downloads the voice model, about 2.5 GB)...`);
  const r = (await runVoice(args, log)) as { recorded: string[]; skipped: string[]; clips: number; seconds: number };
  return { result: r, text: `recorded ${r.recorded.length}, reused ${r.skipped.length}; ${r.clips} clips, ${r.seconds}s of narration` };
}

/**
 * Pick the frame for `still`.
 * 1. --frame N is used as is.
 * 2. --beat s1b2 takes the middle of that beat; --at 12.5 converts seconds to a frame.
 * 3. With none given, the middle of the first beat.
 */
async function pickFrame(a: Args, video: ReturnType<typeof requireVideo>, fps: number): Promise<number> {
  const frame = flagNum(a, "frame");
  if (frame !== undefined) return Math.floor(frame);
  const at = flagNum(a, "at");
  if (at !== undefined) return Math.floor(at * fps);
  const { timeline } = await timelineFor(video, fps);
  const want = flagStr(a, "beat") ?? timeline.beats[0]?.id;
  const b = timeline.beats.find((x) => x.id === want);
  if (!b) throw new UserError(`No beat "${want}". Run \`eigencast info ${video.slug}\` to list beats.`);
  return b.start + Math.floor(b.frames / 2);
}

export async function still(a: Args) {
  const project = findProject();
  const video = requireVideo(project, a.positional[0]);
  const frame = await pickFrame(a, video, project.config.fps);
  const out = flagStr(a, "out");
  const r = await renderStill(project, video, frame, out && resolve(out), log);
  return { result: { ...r, frame }, text: `wrote ${r.output} (frame ${frame} of ${r.totalFrames})` };
}

export async function render(a: Args) {
  const project = findProject();
  const video = requireVideo(project, a.positional[0]);
  const out = flagStr(a, "out");
  const concurrency = flagNum(a, "concurrency");
  if (concurrency !== undefined && !(Number.isInteger(concurrency) && concurrency >= 1)) throw new UserError("--concurrency needs a whole number of at least 1.");
  const r = await renderVideo(project, video, out && resolve(out), log, concurrency);
  return { result: r, text: `wrote ${r.output} (${r.seconds.toFixed(1)}s, ${r.totalFrames} frames)` };
}

export async function preview(_a: Args) {
  const code = await openStudio(findProject());
  return { result: { exitCode: code }, text: "studio closed", exitCode: code };
}

/**
 * Narration-driven timeline.
 *
 * An animation is a list of scenes, each with a fixed design duration and beats
 * ([designTime, phase, caption]). Each beat gets one narration clip; the clip's length
 * decides how many video frames the beat lasts, and the beat's design-time window is
 * stretched or squeezed to fit those frames.
 */

export type Beat = [number, string, string];
export type SceneDef = { name: string; dur: number; beats: Beat[] };
export type ClipTiming = Record<string, { seconds: number }>;

export type TimelineBeat = {
  id: string;
  sceneIndex: number;
  t0: number;
  t1: number;
  phase: string;
  caption: string;
  start: number;
  frames: number;
  hasAudio: boolean;
};

export type Timeline = { beats: TimelineBeat[]; total: number; fps: number };

/** Silence after each clip before the next beat starts. */
export const PAD_SECONDS = 0.5;
/** A beat never runs faster than this fraction of its design window, so animations stay readable. */
export const MIN_STRETCH = 0.55;

export const beatId = (sceneIndex: number, beatIndex: number) => `s${sceneIndex}b${beatIndex}`;

/**
 * Lay every beat out on the frame timeline.
 * 1. For each beat, its design window is [t, next beat's t) or the scene end.
 * 2. Its length is clip seconds + PAD_SECONDS, at least MIN_STRETCH × window
 *    (beats without a clip yet use the window itself, so Studio works before TTS runs).
 * 3. Convert to whole frames and place beats back to back.
 */
export function buildTimeline(scenes: SceneDef[], clips: ClipTiming, fps: number): Timeline {
  const beats: TimelineBeat[] = [];
  let start = 0;
  scenes.forEach((scene, si) => {
    scene.beats.forEach(([t0, phase, caption], bi) => {
      const t1 = bi + 1 < scene.beats.length ? scene.beats[bi + 1][0] : scene.dur;
      const id = beatId(si, bi);
      const clip = clips[id];
      const seconds = clip ? Math.max(clip.seconds + PAD_SECONDS, MIN_STRETCH * (t1 - t0)) : t1 - t0;
      const frames = Math.ceil(seconds * fps);
      beats.push({ id, sceneIndex: si, t0, t1, phase, caption, start, frames, hasAudio: Boolean(clip) });
      start += frames;
    });
  });
  return { beats, total: start, fps };
}

/** Map a video frame to the beat it falls in and the scene's design time at that frame. */
export function locate(tl: Timeline, frame: number): { beat: TimelineBeat; sceneTime: number } {
  let lo = 0;
  let hi = tl.beats.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tl.beats[mid].start <= frame) lo = mid;
    else hi = mid - 1;
  }
  const beat = tl.beats[lo];
  const u = Math.min(1, Math.max(0, (frame - beat.start) / beat.frames));
  return { beat, sceneTime: beat.t0 + u * (beat.t1 - beat.t0) };
}

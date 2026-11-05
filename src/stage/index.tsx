import { Composition } from "remotion";
import { buildTimeline, type ClipTiming, type SceneDef } from "../timeline";
import { NarratedCanvas, VIDEO_H, VIDEO_W, type RenderFrame } from "./NarratedCanvas";

/** What a video's draw file exports: named SCENES + renderFrame, or a default from defineVideo(). */
export type DrawModule = {
  SCENES?: SceneDef[];
  renderFrame?: RenderFrame;
  default?: { SCENES: SceneDef[]; renderFrame: RenderFrame };
};

/** One video as the generated entry file hands it over. */
export type VideoInput = {
  slug: string;
  module: DrawModule;
  timing: { beats: ClipTiming };
  audio: Record<string, string>;
};

function resolveDraw(slug: string, mod: DrawModule): { SCENES: SceneDef[]; renderFrame: RenderFrame } {
  const src = mod.default ?? mod;
  if (!src.SCENES || !src.renderFrame) {
    throw new Error(`videos/${slug}/draw: export default defineVideo([...]), or export SCENES and renderFrame`);
  }
  return { SCENES: src.SCENES, renderFrame: src.renderFrame };
}

/**
 * Build the Remotion root: one 1920×1080 composition per video.
 * 1. Resolve each draw module's scenes and frame renderer.
 * 2. Build its timeline from the recorded clip lengths.
 * 3. Register a Composition whose length is the timeline's total frames.
 */
export function makeRoot(videos: VideoInput[], fps: number): React.FC {
  const entries = videos.map((v) => {
    const { SCENES, renderFrame } = resolveDraw(v.slug, v.module);
    const timeline = buildTimeline(SCENES, v.timing.beats ?? {}, fps);
    const Video: React.FC = () => <NarratedCanvas timeline={timeline} renderFrame={renderFrame} audio={v.audio} />;
    return { slug: v.slug, Video, total: timeline.total };
  });
  const Root: React.FC = () => (
    <>
      {entries.map((e) => (
        <Composition
          key={e.slug}
          id={e.slug}
          component={e.Video}
          durationInFrames={Math.max(1, e.total)}
          fps={fps}
          width={VIDEO_W}
          height={VIDEO_H}
        />
      ))}
    </>
  );
  return Root;
}

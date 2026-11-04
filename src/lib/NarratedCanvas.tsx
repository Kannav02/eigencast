import { useCallback } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Captions } from "./Captions";
import { CanvasStage } from "./CanvasStage";
import { COLORS } from "./theme";
import { locate, type Timeline } from "./timeline";

/** Design-space size of canvas scenes (all scenes draw in 960×540 units). */
export const DESIGN_W = 960;
export const DESIGN_H = 540;
const SCALE = 1.75; // 960×540 → 1680×945 on a 1920×1080 frame
const CANVAS_TOP = 8;

type Props = {
  slug: string;
  timeline: Timeline;
  renderFrame: (ctx: CanvasRenderingContext2D, sceneIndex: number, sceneTime: number, scale: number) => void;
};

/**
 * A full narrated video from a canvas scene module.
 * 1. Find the beat for the current frame and the scene's design time.
 * 2. Draw that moment on the canvas; show the beat's caption below it.
 * 3. Play each beat's narration clip from public/<slug>/audio/<beat>.wav.
 */
export const NarratedCanvas: React.FC<Props> = ({ slug, timeline, renderFrame }) => {
  const frame = useCurrentFrame();
  const { beat, sceneTime } = locate(timeline, frame);
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => renderFrame(ctx, beat.sceneIndex, sceneTime, SCALE),
    [renderFrame, beat.sceneIndex, sceneTime],
  );
  const w = DESIGN_W * SCALE;
  const h = DESIGN_H * SCALE;

  return (
    <AbsoluteFill style={{ background: COLORS.stage }}>
      <CanvasStage
        draw={draw}
        frame={frame}
        width={w}
        height={h}
        style={{ position: "absolute", left: (1920 - w) / 2, top: CANVAS_TOP }}
      />
      <Captions phase={beat.phase} text={beat.caption} top={CANVAS_TOP + h} />
      {timeline.beats
        .filter((b) => b.hasAudio)
        .map((b) => (
          <Sequence key={b.id} from={b.start} durationInFrames={b.frames} layout="none">
            <Audio src={staticFile(`${slug}/audio/${b.id}.wav`)} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};

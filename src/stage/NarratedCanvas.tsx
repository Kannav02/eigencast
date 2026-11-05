import { useCallback } from "react";
import { AbsoluteFill, Audio, Sequence, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";
import { locate, type Timeline } from "../timeline";
import { Captions } from "./Captions";
import { CanvasStage } from "./CanvasStage";

/** Design-space size of canvas scenes (all scenes draw in 960×540 units). */
export const DESIGN_W = 960;
export const DESIGN_H = 540;
export const VIDEO_W = 1920;
export const VIDEO_H = 1080;
const SCALE = 1.75; // 960×540 → 1680×945 on a 1920×1080 frame
const CANVAS_TOP = 8;

export type RenderFrame = (ctx: CanvasRenderingContext2D, sceneIndex: number, sceneTime: number, scale: number) => void;

type Props = {
  timeline: Timeline;
  renderFrame: RenderFrame;
  /** Beat id → audio URL (bundled by webpack). Beats without an entry play silent. */
  audio: Record<string, string>;
};

/**
 * A full narrated video from a canvas scene module.
 * 1. Find the beat for the current frame and the scene's design time.
 * 2. Draw that moment on the canvas; show the beat's caption below it.
 * 3. Place each beat's narration clip at the beat's first frame.
 */
export const NarratedCanvas: React.FC<Props> = ({ timeline, renderFrame, audio }) => {
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
        style={{ position: "absolute", left: (VIDEO_W - w) / 2, top: CANVAS_TOP }}
      />
      <Captions phase={beat.phase} text={beat.caption} top={CANVAS_TOP + h} />
      {timeline.beats
        .filter((b) => b.hasAudio && audio[b.id])
        .map((b) => (
          <Sequence key={b.id} from={b.start} durationInFrames={b.frames} layout="none">
            <Audio src={audio[b.id]} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};

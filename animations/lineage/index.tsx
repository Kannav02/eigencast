import { NarratedCanvas } from "../../src/lib/NarratedCanvas";
import { buildTimeline, type ClipTiming, type SceneDef } from "../../src/lib/timeline";
import type { AnimationEntry } from "../../src/registry";
import { SCENES, renderFrame } from "./draw.js";
import timing from "./timing.json";

const FPS = 30;
const timeline = buildTimeline(SCENES as SceneDef[], (timing as { beats: ClipTiming }).beats, FPS);

const Lineage: React.FC = () => <NarratedCanvas slug="lineage" timeline={timeline} renderFrame={renderFrame} />;

export const lineage: AnimationEntry = {
  id: "lineage",
  component: Lineage,
  durationInFrames: timeline.total,
  fps: FPS,
};

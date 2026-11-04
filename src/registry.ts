import { lineage } from "../animations/lineage";

export type AnimationEntry = {
  id: string;
  component: React.FC;
  durationInFrames: number;
  fps: number;
};

/** Every animation in this repo. Add new ones here to make them show up in Studio and `render`. */
export const ANIMATIONS: AnimationEntry[] = [lineage];

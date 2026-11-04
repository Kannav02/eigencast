import { Composition } from "remotion";
import { ANIMATIONS } from "./registry";

export const Root: React.FC = () => (
  <>
    {ANIMATIONS.map((a) => (
      <Composition
        key={a.id}
        id={a.id}
        component={a.component}
        durationInFrames={a.durationInFrames}
        fps={a.fps}
        width={1920}
        height={1080}
      />
    ))}
  </>
);

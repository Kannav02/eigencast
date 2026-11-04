import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { fontsLoaded } from "./theme";

type Props = {
  /** Draws the frame; called after fonts load and again on every frame change. */
  draw: (ctx: CanvasRenderingContext2D) => void;
  /** Re-draw whenever this changes (normally the current frame). */
  frame: number;
  width: number;
  height: number;
  style?: React.CSSProperties;
};

/**
 * A canvas that redraws on every frame and holds the render until fonts are ready,
 * so the first captured frame never uses fallback fonts.
 */
export const CanvasStage: React.FC<Props> = ({ draw, frame, width, height, style }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender("canvas fonts"));
  const released = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fontsLoaded.then(() => setReady(true));
  }, []);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ready || !ctx) return;
    draw(ctx);
    if (!released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [ready, frame, draw, handle]);

  return <canvas ref={ref} width={width} height={height} style={style} />;
};

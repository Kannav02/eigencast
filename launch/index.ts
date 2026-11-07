// Remotion entry for the launch video. registerRoot must appear literally in this file.
import { createElement } from "react";
import { Composition, registerRoot } from "remotion";
import { FPS, Launch, TOTAL } from "./Launch";

const Root = () => createElement(Composition, { id: "launch", component: Launch, durationInFrames: TOTAL, fps: FPS, width: 1920, height: 1080 });

registerRoot(Root);

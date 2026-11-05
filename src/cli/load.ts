/** Load a video's draw file inside the CLI (outside the browser) to read its scenes. */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { plugin } from "bun";
import { PKG_ROOT, type Video } from "../project";
import type { DrawModule } from "../stage";
import type { SceneDef } from "../timeline";

let registered = false;

/** Resolve `eigencast/<module>` imports in user draw files to this package's source. */
function registerAlias() {
  if (registered) return;
  registered = true;
  plugin({
    name: "eigencast-alias",
    setup(build) {
      build.onResolve({ filter: /^eigencast(\/.*)?$/ }, (args) => {
        const sub = args.path.slice("eigencast".length).replace(/^\//, "") || "draw";
        const base = join(PKG_ROOT, "src", sub);
        const path = ["index.ts", "index.tsx"].map((f) => join(base, f)).find(existsSync) ?? `${base}.ts`;
        return { path };
      });
    },
  });
}

/** Import the draw file and return its scene list. Throws with the import error if it fails to load. */
export async function loadScenes(video: Video): Promise<SceneDef[]> {
  registerAlias();
  const mod = (await import(video.drawFile!)) as DrawModule;
  const src = mod.default ?? mod;
  if (!src.SCENES || !src.renderFrame) {
    throw new Error(`videos/${video.slug}/${video.drawFile!.split("/").pop()} must \`export default defineVideo([...])\` (or export SCENES and renderFrame).`);
  }
  return src.SCENES;
}

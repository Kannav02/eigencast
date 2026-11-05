/** `init` creates a project folder; `new` adds a video to it. */
import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { CONFIG_FILE, PKG_ROOT, PKG_VERSION, UserError, findProject, videoAt } from "../../project";
import { type Args, flagStr, log } from "../args";

const TEMPLATES = join(PKG_ROOT, "templates");
const SKILL = join(PKG_ROOT, "skills", "eigencast", "SKILL.md");
const IGNORE = [".eigencast/", "out/", "node_modules/"];

/**
 * Create (or adopt) a project folder.
 * 1. Write eigencast.json, a package.json depending on eigencast, and .gitignore entries.
 * 2. Copy the agent skill to .claude/skills/eigencast/ (Claude Code and OpenCode read it) and AGENTS.md.
 * 3. Run `bun install` unless --no-install.
 */
export function init(a: Args) {
  const root = resolve(a.positional[0] ?? ".");
  mkdirSync(join(root, "videos"), { recursive: true });
  const created: string[] = [];
  const write = (rel: string, content: string) => {
    const file = join(root, rel);
    if (existsSync(file)) return;
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, content);
    created.push(rel);
  };
  write(CONFIG_FILE, JSON.stringify({ fps: 30 }, null, 2) + "\n");
  const spec = flagStr(a, "from") ?? `^${PKG_VERSION}`;
  write("package.json", JSON.stringify({ name: basename(root), private: true, dependencies: { eigencast: spec } }, null, 2) + "\n");
  write("AGENTS.md", readFileSync(join(TEMPLATES, "AGENTS.md"), "utf8"));
  const skillDest = join(root, ".claude", "skills", "eigencast");
  mkdirSync(skillDest, { recursive: true });
  copyFileSync(SKILL, join(skillDest, "SKILL.md"));
  created.push(".claude/skills/eigencast/SKILL.md");

  const gi = join(root, ".gitignore");
  const have = existsSync(gi) ? readFileSync(gi, "utf8").split("\n") : [];
  const missing = IGNORE.filter((l) => !have.includes(l));
  if (missing.length) appendFileSync(gi, (have.length && have.at(-1) !== "" ? "\n" : "") + missing.join("\n") + "\n");

  let installed = false;
  if (!a.flags["no-install"]) {
    log("installing eigencast with bun...");
    const r = spawnSync("bun", ["install"], { cwd: root, stdio: ["ignore", "inherit", "inherit"] });
    if (r.status !== 0) throw new UserError("`bun install` failed. Fix the error above, then run `bun install` in the project.");
    installed = true;
  }
  return {
    result: { root, created, installed },
    text: `Project ready at ${root}\nNext: cd ${root} && bunx eigencast new <slug>`,
  };
}

/** Copy the starter video into videos/<slug>/. */
export function newVideo(a: Args) {
  const slug = a.positional[0];
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new UserError("Give the video a slug: lowercase letters, digits and dashes, e.g. `eigencast new dot-product`.");
  }
  const project = findProject();
  const v = videoAt(project, slug);
  if (existsSync(v.dir)) throw new UserError(`videos/${slug} already exists.`);
  cpSync(join(TEMPLATES, "video"), v.dir, { recursive: true });
  return {
    result: { slug, dir: v.dir, files: ["draw.js", "script.json"] },
    text: `Created videos/${slug}/draw.js and script.json. Edit both, then run \`eigencast check ${slug}\`.`,
  };
}

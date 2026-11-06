/** `init` creates a project folder; `new` adds a video to it. */
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { CONFIG_FILE, PKG_ROOT, PKG_VERSION, UserError, findProject, videoAt } from "../../project";
import { type Args, flagStr, log } from "../args";

const TEMPLATES = join(PKG_ROOT, "templates");
const SKILL = join(PKG_ROOT, "skills", "eigencast", "SKILL.md");
const IGNORE = [".eigencast/", "out/", "node_modules/"];

/** Like existsSync, but a dangling symlink counts as existing (so we never write through it). */
const present = (file: string) => {
  try {
    lstatSync(file);
    return true;
  } catch {
    return false;
  }
};

/**
 * The dependency spec for `--from`.
 * 1. A local tarball or folder becomes an absolute `file:` path, so it resolves from the new project.
 * 2. A version or dist-tag (`0.1.0`, `^0.1`, `latest`) is used as is.
 * 3. URLs and git specs are refused: they install arbitrary code from the network.
 */
export function fromSpec(from: string): string {
  const path = from.startsWith("file:") ? from.slice(5) : from;
  if (existsSync(resolve(path))) return `file:${resolve(path)}`;
  if (from.startsWith("file:")) throw new UserError(`--from: ${resolve(path)} does not exist.`);
  if (/^[\w.^~<>=| *-]+$/.test(from) && !from.includes("/")) return from;
  throw new UserError(`--from takes a version (e.g. 0.1.0) or a path to a local eigencast .tgz or folder, got "${from}".`);
}

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
    if (present(file)) return;
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, content);
    created.push(rel);
  };
  write(CONFIG_FILE, JSON.stringify({ fps: 30 }, null, 2) + "\n");
  const from = flagStr(a, "from");
  const spec = from ? fromSpec(from) : `^${PKG_VERSION}`;
  write("package.json", JSON.stringify({ name: basename(root), private: true, dependencies: { eigencast: spec } }, null, 2) + "\n");
  write("AGENTS.md", readFileSync(join(TEMPLATES, "AGENTS.md"), "utf8"));
  // The skill is refreshed on every init so it matches this version of the CLI. A symlink planted
  // at that path is replaced, not followed, so init never writes outside the project.
  const skillDest = join(root, ".claude", "skills", "eigencast");
  mkdirSync(skillDest, { recursive: true });
  const escape = relative(realpathSync(root), realpathSync(skillDest));
  if (escape.startsWith(`..${sep}`) || escape === "..") throw new UserError(".claude/skills/eigencast points outside the project (a symlink?). Remove it and run init again.");
  const skillFile = join(skillDest, "SKILL.md");
  const skill = readFileSync(SKILL, "utf8");
  const had = present(skillFile);
  if (had && lstatSync(skillFile).isSymbolicLink()) unlinkSync(skillFile);
  if (!had || !existsSync(skillFile) || readFileSync(skillFile, "utf8") !== skill) {
    writeFileSync(skillFile, skill);
    created.push(".claude/skills/eigencast/SKILL.md");
    if (had) log("updated .claude/skills/eigencast/SKILL.md to this version of eigencast");
  }

  const gi = join(root, ".gitignore");
  if (present(gi) && lstatSync(gi).isSymbolicLink()) throw new UserError(".gitignore is a symlink; init won't write through it. Replace it with a real file and run init again.");
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

/** `doctor` checks the machine and project before anything runs, and says how to fix each problem. */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PKG_ROOT, PKG_VERSION, findProject, listVideos } from "../../project";
import type { Args } from "../args";

type Check = { name: string; ok: boolean; detail: string; fix?: string };

const PRESET_MODEL_DIR = "models--mlx-community--Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit";

function version(cmd: string, args = ["--version"]): string | null {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim().split("\n")[0] : null;
}

/**
 * Run every check.
 * 1. Runtime: bun, uv (for the voice step), Apple Silicon (the current voice model needs it).
 * 2. Package: fonts present; voice model cached or not (first `voice` run downloads it).
 * 3. Project: eigencast.json found, and which videos it has.
 */
export function doctor(_a: Args) {
  const checks: Check[] = [];
  const bun = process.versions.bun;
  checks.push({ name: "bun", ok: Boolean(bun), detail: bun ? `bun ${bun}` : "not running under bun", fix: "Install bun: https://bun.sh" });
  const uv = version("uv");
  checks.push({ name: "uv", ok: Boolean(uv), detail: uv ?? "not found", fix: "Install uv (runs the voice step): curl -LsSf https://astral.sh/uv/install.sh | sh" });
  const apple = process.platform === "darwin" && process.arch === "arm64";
  checks.push({
    name: "voice hardware",
    ok: apple,
    detail: apple ? "Apple Silicon Mac" : `${process.platform}/${process.arch}`,
    fix: "The voice model (Qwen3-TTS via mlx) needs an Apple Silicon Mac. Rendering still works here.",
  });
  const fonts = ["cmu-serif-500-roman.woff2", "cmu-serif-700-roman.woff2", "cmu-serif-500-italic.woff2"].every((f) => existsSync(join(PKG_ROOT, "fonts", f)));
  checks.push({ name: "fonts", ok: fonts, detail: fonts ? "CMU Serif bundled" : "missing from package", fix: "Reinstall eigencast." });
  const hub = process.env.HF_HUB_CACHE ?? join(process.env.HF_HOME ?? join(homedir(), ".cache", "huggingface"), "hub");
  const cached = existsSync(join(hub, PRESET_MODEL_DIR));
  checks.push({ name: "voice model", ok: true, detail: cached ? "downloaded" : "not downloaded yet (about 2.5 GB, fetched on the first `eigencast voice`)" });

  let videos: string[] = [];
  try {
    const p = findProject();
    videos = listVideos(p).map((v) => v.slug);
    checks.push({ name: "project", ok: true, detail: `${p.root} (${videos.length} video${videos.length === 1 ? "" : "s"}: ${videos.join(", ") || "none yet"})` });
  } catch {
    checks.push({ name: "project", ok: false, detail: "no eigencast.json here or above", fix: "Run `eigencast init <folder>`, or cd into a project." });
  }

  const ok = checks.every((c) => c.ok);
  const text = [
    `eigencast ${PKG_VERSION}`,
    ...checks.map((c) => `${c.ok ? "ok  " : "FAIL"} ${c.name.padEnd(15)} ${c.detail}${!c.ok && c.fix ? `\n     fix: ${c.fix}` : ""}`),
  ].join("\n");
  return { result: { ok, version: PKG_VERSION, checks }, text, exitCode: ok ? 0 : 1 };
}

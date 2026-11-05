/**
 * End-to-end: pack the package like a publish would, install it into a fresh folder,
 * and drive it only through the `eigencast` command. No voice step (slow, Apple-only).
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dir, "..");
const PROJECT = mkdtempSync(join(tmpdir(), "eigencast-test-"));

function run(cmd: string, args: string[], cwd = PROJECT) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", timeout: 300_000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const eigencast = (...args: string[]) => run("bunx", ["eigencast", ...args, "--json"]);
const json = (r: { stdout: string }) => JSON.parse(r.stdout);

beforeAll(() => {
  const pack = run("bun", ["pm", "pack", "--destination", PROJECT], REPO);
  expect(pack.code).toBe(0);
  const version = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")).version;
  const tgz = join(PROJECT, `eigencast-${version}.tgz`);
  expect(run("bun", ["add", tgz]).code).toBe(0);
  expect(eigencast("init", ".", "--no-install").code).toBe(0);
}, 300_000);

describe("eigencast in a fresh project", () => {
  test("init writes the project files and the agent skill", () => {
    for (const f of ["eigencast.json", "AGENTS.md", ".claude/skills/eigencast/SKILL.md", ".gitignore"]) {
      expect(existsSync(join(PROJECT, f))).toBe(true);
    }
    expect(readFileSync(join(PROJECT, ".gitignore"), "utf8")).toContain(".eigencast/");
  });

  test("new + info: starter video has two beats laid out by design time before any audio", () => {
    expect(eigencast("new", "starter").code).toBe(0);
    const info = json(eigencast("info", "starter"));
    expect(info.beats.map((b: { beat: string }) => b.beat)).toEqual(["s0b0", "s0b1"]);
    expect(info.beats.map((b: { startFrame: number }) => b.startFrame)).toEqual([0, 150]);
    expect(info.totalFrames).toBe(300);
  });

  test("check passes the starter and only warns about missing narration", () => {
    const r = eigencast("check", "starter");
    const out = json(r);
    expect(r.code).toBe(0);
    expect(out.issues.filter((i: { level: string }) => i.level === "error")).toEqual([]);
    expect(out.issues.map((i: { where: string }) => i.where).sort()).toEqual(["s0b0", "s0b1"]);
  });

  test("check rejects randomness and script/beat mismatches", () => {
    expect(eigencast("new", "broken").code).toBe(0);
    const dir = join(PROJECT, "videos", "broken");
    appendFileSync(join(dir, "draw.js"), "\nconst noise = Math.random();\n");
    const script = JSON.parse(readFileSync(join(dir, "script.json"), "utf8"));
    script.beats.s0b9 = "an extra sentence with no beat";
    writeFileSync(join(dir, "script.json"), JSON.stringify(script));
    const r = eigencast("check", "broken");
    expect(r.code).toBe(1);
    const messages = json(r).issues.map((i: { where: string; message: string }) => `${i.where}: ${i.message}`).join("\n");
    expect(messages).toContain("Math.random");
    expect(messages).toContain("s0b9: in script.json but no matching beat");
  });

  test("still renders a PNG of a beat", () => {
    const r = eigencast("still", "starter", "--beat", "s0b1");
    expect(r.code).toBe(0);
    const out = json(r);
    expect(out.frame).toBe(225);
    expect(statSync(out.output).size).toBeGreaterThan(20_000);
  }, 300_000);

  test("render writes the full mp4 (silent before narration is recorded)", () => {
    const r = eigencast("render", "starter");
    expect(r.code).toBe(0);
    const out = json(r);
    expect(out.totalFrames).toBe(300);
    expect(out.seconds).toBe(10);
    expect(statSync(out.output).size).toBeGreaterThan(50_000);
  }, 300_000);

  test("render rejects a bad --concurrency", () => {
    const r = eigencast("render", "starter", "--concurrency", "0");
    expect(r.code).toBe(1);
    expect(json(r).error).toContain("--concurrency");
  });

  test("unknown video names the ones that exist", () => {
    const r = eigencast("still", "nope");
    expect(r.code).toBe(1);
    expect(json(r).error).toContain("broken, starter");
  });
});

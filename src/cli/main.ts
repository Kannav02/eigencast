#!/usr/bin/env bun
/** eigencast: narrated, Manim-style explainer videos from a script and a canvas draw file. */
import { writeSync } from "node:fs";
import { PKG_VERSION, UserError } from "../project";
import { type Args, parseArgs } from "./args";
import { doctor } from "./commands/doctor";
import { check, info } from "./commands/inspect";
import { preview, render, still, voice } from "./commands/media";
import { init, newVideo } from "./commands/scaffold";

type Outcome = { result: unknown; text: string; exitCode?: number };
type Command = { run: (a: Args) => Outcome | Promise<Outcome>; usage: string; about: string };

const COMMANDS: Record<string, Command> = {
  init: { run: init, usage: "init [folder] [--no-install]", about: "create a project folder (with the agent skill)" },
  new: { run: newVideo, usage: "new <slug>", about: "add a video from the starter template" },
  check: { run: check, usage: "check <slug> [--listen]", about: "find mistakes: missing text or clips, randomness, bad beats" },
  info: { run: info, usage: "info <slug>", about: "list beats with their frames and lengths" },
  voice: { run: voice, usage: "voice <slug> [--force] [--only s1b2 ...]", about: "record narration for changed beats" },
  still: { run: still, usage: "still <slug> [--beat s1b2 | --frame N | --at SECONDS] [--out file.png]", about: "render one frame to a PNG" },
  render: { run: render, usage: "render <slug> [--out file.mp4] [--concurrency N]", about: "render the full video" },
  preview: { run: preview, usage: "preview", about: "open Remotion Studio to scrub through videos" },
  doctor: { run: doctor, usage: "doctor", about: "check the machine and project setup" },
};

function help(): string {
  const w = Math.max(...Object.values(COMMANDS).map((c) => c.usage.length));
  return [
    `eigencast ${PKG_VERSION}: narrated explainer videos`,
    "",
    "Usage: eigencast <command> [options]   (add --json for machine-readable output)",
    "",
    ...Object.values(COMMANDS).map((c) => `  ${c.usage.padEnd(w)}  ${c.about}`),
  ].join("\n");
}

async function main() {
  const [name, ...rest] = process.argv.slice(2);
  if (!name || name === "help" || name === "--help" || name === "-h") return void console.log(help());
  if (name === "--version" || name === "-v") return void console.log(PKG_VERSION);
  const cmd = COMMANDS[name];
  const args = parseArgs(rest);
  const json = Boolean(args.flags.json);
  if (!cmd) {
    console.error(`Unknown command "${name}".\n\n${help()}`);
    process.exit(2);
  }
  // Libraries (Remotion's browser download, progress) print to stdout; keep stdout for the result only.
  // The result is written synchronously to fd 1 so process.exit() can't cut it off.
  process.stdout.write = process.stderr.write.bind(process.stderr) as typeof process.stdout.write;
  console.log = console.info = console.error;
  const emit = (s: string) => writeSync(1, `${s}\n`);
  try {
    const out = await cmd.run(args);
    emit(json ? JSON.stringify(out.result, null, 2) : out.text);
    process.exit(out.exitCode ?? 0);
  } catch (e) {
    const message = (e as Error).message;
    if (json) emit(JSON.stringify({ ok: false, error: message }));
    else console.error(e instanceof UserError ? message : `error: ${(e as Error).stack ?? message}`);
    process.exit(1);
  }
}

main();

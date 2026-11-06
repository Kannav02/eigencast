# eigencast (package source)

This repo is the eigencast package: a bun CLI + Remotion engine (`src/`) and a Python voice package (`python/`). User-facing agent instructions live in `skills/eigencast/SKILL.md`; keep it in sync when commands or the draw kit change. `examples/lineage` is a full project used for manual testing.

## Pins
- remotion / @remotion/* 4.0.540 (all @remotion/* on the same exact version)
- react 19.3.1, typescript 7.0.2, bun >= 1.3 (dev: 1.4.0)
- Python 3.13 via uv, mlx-audio 0.6.4 (python/uv.lock, run with `--frozen`)
- TTS models: preset `mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit` (Ryan, Aiden); clone `mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16`

## Commands
- Run the CLI from source inside a project: `cd examples/lineage && bun ../../src/cli/main.ts <command>`
- Typecheck: `npx tsc --noEmit`
- Tests: `bun test` (integration: packs the tarball, inits a temp project, renders a still)
- Pack like npm would: `bun pm pack` → `eigencast-<version>.tgz`; try it with `eigencast init /tmp/x --from /abs/path/eigencast-<version>.tgz`

## How the pieces connect (non-obvious parts)
- No Remotion `public/` dir. `src/render/entry.ts` generates `<project>/.eigencast/entry.ts` that imports each video's draw file, timing.json and wav clips; webpack bundles them as assets.
- `eigencast/*` imports in user draw files resolve through aliases, not node_modules: webpack alias in `src/render/entry.ts`, Bun plugin in `src/cli/load.ts` (the CLI imports draw files to read scenes). Change both together.
- `remotion studio` only takes webpack settings from a config file, so `preview` writes `.eigencast/remotion.config.ts`.
- Remotion Studio listens on every interface and has no host option; `preview` preloads `src/render/loopback.cjs` into it to force 127.0.0.1.
- Beat ids (`s<scene>b<beat>`) become file names and import identifiers: both the CLI (`BEAT_ID` in `src/project.ts`) and the voice package (`check_beat_ids`) reject anything else.
- The entry file must literally contain `registerRoot` or Remotion's bundler refuses it.
- The voice venv lives in `~/.cache/eigencast/voice-<version>` (UV_PROJECT_ENVIRONMENT), not in node_modules.
- Clip hashes are `sha1(json.dumps([text, voice], sort_keys=True))[:12]`; changing that re-records every user's clips.
- `src/theme` must stay plain constants: the CLI imports it under bun, outside the browser. Font loading is in `src/stage/fonts.ts`.

## Hard rules
- Every frame is a pure function of the frame number: no `Math.random`, `Date`, timers, rAF in anything that draws.
- House style: pure black, Manim palette (`COLORS` in `src/theme`), CMU Serif for all text, outlines not filled cards. No 3b1b logo or characters, and keep "3Blue1Brown" out of names and branding.
- Don't add `"type": "module"` to package.json: webpack would require file extensions on imports from `.js` files.

## Machine gotchas
- `~/.npm` has root-owned files: use bun, or `npm_config_cache=$TMPDIR/npm-cache` for npx.
- In the Claude Code sandbox, Remotion (Chrome) and uv (panics reading macOS proxy config) must run with the sandbox disabled.
- First render downloads Chrome Headless Shell; first `voice` downloads the 2.5 GB preset model to `~/.cache/huggingface`.

## Launch video
- `launch/` is a standalone Remotion composition for the 30 s launch video (not shipped: package.json `files` leaves it out).
- `bun launch/render.ts` renders `launch/out/eigencast-launch.mp4`; `--frame N` renders one still. Set `REMOTION_CHROME` to reuse an existing Chrome binary.
- The music is synthesized by `launch/music.ts` (no samples); render generates `launch/assets/music.wav` if it's missing.
- The payoff clip and `launch/stills/derivative-f558.png` come from the Claude Code benchmark run (`docs/benchmark/claude-opus-5-5`); the Claude Code transcript is a reconstruction of that run using the CLI's real output formats.

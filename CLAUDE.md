# animation-kannav

Narrated explainer videos. Claude writes the code; Remotion renders frames, Qwen3-TTS speaks, ffmpeg does any post work. One Remotion project, many animations: each lives in `animations/<slug>/` and is registered in `src/registry.ts`.

## Pins
- remotion / @remotion/cli / @remotion/fonts 4.0.540 (keep all @remotion/* on the same exact version)
- react 19.3.1, typescript 7.0.2, node 26
- Python 3.13 via uv, mlx-audio 0.6.4
- TTS models: preset voice `mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit` (speakers Ryan, Aiden for English); cloning `mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16`

## Commands
- Voice clips: `uv run python -m tts.generate <slug>` (only regenerates changed beats; `--only s2b3` or `--force` to redo)
- Studio preview: `npm run studio`
- Still check: `npx remotion still src/index.ts <slug> out/<slug>-f<N>.png --frame=<N>`
- Render: `npx remotion render src/index.ts <slug> out/<slug>.mp4`
- Typecheck: `npx tsc --noEmit`

## Workflow for a new animation
1. Write the script as numbered scenes, each with beats (design time, phase, caption). Phases: SCORE, LOSS, WALL, FIX, OVERVIEW, or new ones added to `PHASE_COLORS`.
2. Put spoken text per beat id (`s<scene>b<beat>`) in `animations/<slug>/script.json`. Spoken text spells out math ("w times x plus b"); captions keep symbols. Get the user to approve the script before generating audio.
3. Run TTS. It writes `public/<slug>/audio/<beat>.wav` and `animations/<slug>/timing.json`.
4. Build visuals. Canvas scenes: a `draw.js` exporting `SCENES` and `renderFrame(ctx, sceneIndex, t, scale)`, wrapped by `NarratedCanvas`. Pure React scenes are fine too; they must still use `timeline.ts` for timing.
5. Check 4-6 stills across scenes, fix, then render the full mp4.

## Hard rules
- Audio sets the timing. Each beat lasts its clip + 0.5 s (min 0.55 × its design window); the design-time window is stretched to fit. Never hardcode frame counts for narrated beats.
- Every frame must be a pure function of the frame number: no `Math.random` (use seeded RNG), no `Date`, no timers, no requestAnimationFrame.
- House style is 3Blue1Brown-like: pure black, Manim's palette (`COLORS` in `src/lib/theme.ts`, hex values are Manim constants), Computer Modern (CMU Serif, OFL, files in `public/fonts/`) for all text, outlines instead of filled cards, plain centered subtitles. No 3b1b logo or characters.
- Canvas text needs fonts loaded first. Use `CanvasStage`, which holds the render until `fontsLoaded` resolves. Always use `FONTS` from `src/lib/theme.ts`, never hardcode family names. CMU Serif reads small: canvas scenes scale text sizes by `TEXT_SCALE` (1.12).
- Don't add `"type": "module"` to package.json: it makes webpack require file extensions on imports from `.js` files.
- Colors only from `COLORS` in `src/lib/theme.ts`.

## Machine gotchas
- `~/.npm` has root-owned files: run npm with `npm_config_cache=$TMPDIR/npm-cache`.
- In the Claude Code sandbox, Remotion (node ignores the sandbox proxy, Chrome download/launch) and uv (panics reading macOS proxy config) must run with the sandbox disabled.
- First Remotion render downloads Chrome Headless Shell; first TTS run downloads the preset-voice model (2.5 GB) to `~/.cache/huggingface`.
- Voice cloning: put 10-20 s of clean speech in `voice/ref.wav` and its exact words in `voice/ref.txt`, then set `"mode": "clone"` in the script's `voice`.

## ffmpeg (post work only; Remotion encodes the main render)
- Music under narration: `ffmpeg -i out/x.mp4 -i music.wav -filter_complex "[1:a]volume=0.12[m];[0:a][m]amix=inputs=2:duration=first[a]" -map 0:v -map "[a]" -c:v copy out/x-music.mp4`
- Trim: `ffmpeg -ss 00:01:00 -to 00:02:00 -i in.mp4 -c copy out.mp4`

# eigencast

Narrated, Manim-style explainer videos (black background, Computer Modern text, AI voice-over), made by coding agents.

You write two files per video: a **script** (what the narrator says) and a **draw file** (what is on screen). eigencast records each sentence with a local AI voice, lets the recordings set the timing, and renders a 1920×1080 mp4 with Remotion.

## Install

Needs [bun](https://bun.sh) and [uv](https://docs.astral.sh/uv/). The voice step needs an Apple Silicon Mac (Qwen3-TTS via mlx); everything else runs anywhere bun does.

```bash
bunx eigencast init my-videos
cd my-videos
bunx eigencast doctor
```

`init` creates the project folder with `eigencast.json`, a `package.json`, `AGENTS.md`, and the agent skill in `.claude/skills/eigencast/SKILL.md`. Your videos live in that folder, not inside the package.

## Use it with an agent

- **Claude Code**: open the project folder and ask for a video. The skill loads from `.claude/skills/`. Or install the plugin anywhere: `/plugin marketplace add Kannav02/eigencast`.
- **OpenCode**: reads the same `.claude/skills/` folder and `AGENTS.md`. Nothing extra to set up.
- **Anything else**: point it at `AGENTS.md`.

## Commands

| Command | What it does |
|---|---|
| `eigencast init [folder]` | Create a project |
| `eigencast new <slug>` | Add a video from the starter template |
| `eigencast check <slug> [--listen]` | Find mistakes before rendering |
| `eigencast voice <slug> [--force] [--only s1b2]` | Record narration (only changed sentences) |
| `eigencast info <slug>` | List beats with their frames and lengths |
| `eigencast still <slug> --beat s1b2` | Render one frame to a PNG |
| `eigencast render <slug>` | Render the mp4 |
| `eigencast preview` | Open Remotion Studio |
| `eigencast doctor` | Check the setup |

Add `--json` to any command for machine-readable output.

## How it fits together

| Module | Job |
|---|---|
| `python/eigencast_voice/voice.py` | Text in, audio out (Qwen3-TTS backend) |
| `python/eigencast_voice/narrate.py` | Record every beat, skip unchanged ones, write `timing.json` |
| `src/timeline` | Recording lengths → how long each beat stays on screen |
| `src/stage` | Draw one frame: canvas, caption, audio placement (React/Remotion) |
| `src/draw` | Drawing kit for scenes (`defineVideo`, plots, axes, text, arrows) |
| `src/render` | Bundle the project and render stills, mp4s, or the studio |
| `src/cli` | The commands above |
| `skills/eigencast/SKILL.md` | Instructions for the agent |

See `examples/lineage` for a full 7-minute video. Fonts: CMU Serif (OFL, `fonts/OFL.txt`).

# Videos made with eigencast

This folder makes narrated, Manim-style explainer videos with the `eigencast` CLI.
Before writing or changing any video, read `.claude/skills/eigencast/SKILL.md` and follow it.
It has the workflow, the file formats, the drawing kit, and the rules every frame must follow.

Quick reference (run from this folder):
- `bunx eigencast new <slug>` creates `videos/<slug>/draw.js` and `script.json`
- `bunx eigencast check <slug>` finds mistakes; run it after every edit
- `bunx eigencast voice <slug>` records narration (only changed sentences)
- `bunx eigencast still <slug> --beat s1b0` renders one frame to `out/` to look at
- `bunx eigencast render <slug>` renders `out/<slug>.mp4`
Add `--json` to any command for machine-readable output.
Only run these commands in projects you trust: they execute `videos/*/draw.js` (see Safety in SKILL.md).

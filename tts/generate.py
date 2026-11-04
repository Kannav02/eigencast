"""Generate one narration clip per beat with Qwen3-TTS and record clip durations.

Usage:
    uv run python -m tts.generate <animation-slug> [--force] [--only BEAT_ID ...]
"""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from mlx_audio.tts.utils import load_model

ROOT = Path(__file__).resolve().parent.parent
PRESET_MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit"
CLONE_MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16"
VOICE_DIR = ROOT / "voice"


def clip_hash(text: str, voice: dict) -> str:
    """Hash of the spoken text and voice settings, used to skip unchanged clips."""
    return hashlib.sha1(json.dumps([text, voice], sort_keys=True).encode()).hexdigest()[:12]


def synthesize(model, text: str, voice: dict) -> tuple[np.ndarray, int]:
    """Run Qwen3-TTS once and return mono float32 samples and the sample rate."""
    if voice["mode"] == "clone":
        results = list(model.generate(
            text=text,
            ref_audio=str(VOICE_DIR / "ref.wav"),
            ref_text=(VOICE_DIR / "ref.txt").read_text().strip(),
        ))
    else:
        results = list(model.generate_custom_voice(
            text=text,
            speaker=voice["speaker"],
            language="English",
            instruct=voice.get("instruct"),
        ))
    audio = np.concatenate([np.asarray(r.audio, dtype=np.float32) for r in results])
    return audio, results[0].sample_rate


def main() -> None:
    """Generate clips for every beat in an animation's script.

    1. Read animations/<slug>/script.json (voice settings + spoken text per beat id).
    2. Skip beats whose wav exists and whose text/voice hash is unchanged.
    3. Synthesize the rest, write public/<slug>/audio/<beat>.wav.
    4. Write animations/<slug>/timing.json with each clip's duration in seconds.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument("slug")
    parser.add_argument("--force", action="store_true", help="regenerate every clip")
    parser.add_argument("--only", nargs="*", default=[], help="beat ids to regenerate")
    args = parser.parse_args()

    anim_dir = ROOT / "animations" / args.slug
    audio_dir = ROOT / "public" / args.slug / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    script = json.loads((anim_dir / "script.json").read_text())
    voice = script["voice"]
    timing_path = anim_dir / "timing.json"
    timing = json.loads(timing_path.read_text()) if timing_path.exists() else {"beats": {}}

    model = None
    for beat_id, text in script["beats"].items():
        wav = audio_dir / f"{beat_id}.wav"
        h = clip_hash(text, voice)
        cached = timing["beats"].get(beat_id)
        fresh = not args.force and beat_id not in args.only
        if fresh and wav.exists() and cached and cached.get("hash") == h:
            continue
        if model is None:
            model = load_model(CLONE_MODEL if voice["mode"] == "clone" else PRESET_MODEL)
        audio, sr = synthesize(model, text, voice)
        sf.write(wav, audio, sr)
        timing["beats"][beat_id] = {"seconds": round(len(audio) / sr, 3), "hash": h}
        timing_path.write_text(json.dumps(timing, indent=2) + "\n")
        print(f"{beat_id}: {len(audio) / sr:.2f}s", flush=True)

    total = sum(b["seconds"] for b in timing["beats"].values())
    print(f"done: {len(timing['beats'])} clips, {total:.1f}s of narration")


if __name__ == "__main__":
    main()

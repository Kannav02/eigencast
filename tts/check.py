"""Transcribe every narration clip and flag ones that don't match the script.

TTS models sometimes skip, repeat, or garble words; this catches that without listening.

Usage:
    uv run python -m tts.check <animation-slug> [--max-wer 0.15]
"""

import argparse
import json
import re
from pathlib import Path

from mlx_audio.stt.utils import load_model

ROOT = Path(__file__).resolve().parent.parent
STT_MODEL = "mlx-community/parakeet-tdt-0.6b-v3"


def words(text: str) -> list[str]:
    """Lowercase words with punctuation stripped."""
    return re.findall(r"[a-z0-9']+", text.lower().replace("-", " "))


def wer(ref: list[str], hyp: list[str]) -> float:
    """Word error rate via edit distance."""
    prev = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, 1):
        cur = [i] + [0] * len(hyp)
        for j, h in enumerate(hyp, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r != h))
        prev = cur
    return prev[-1] / max(1, len(ref))


def main() -> None:
    """Check every clip of an animation.

    1. Load the script's spoken text per beat and the STT model.
    2. Transcribe public/<slug>/audio/<beat>.wav.
    3. Print word error rate per beat and list beats above the threshold.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument("slug")
    parser.add_argument("--max-wer", type=float, default=0.15)
    args = parser.parse_args()

    script = json.loads((ROOT / "animations" / args.slug / "script.json").read_text())
    model = load_model(STT_MODEL)
    flagged = []
    for beat_id, text in script["beats"].items():
        wav = ROOT / "public" / args.slug / "audio" / f"{beat_id}.wav"
        heard = model.generate(str(wav)).text
        score = wer(words(text), words(heard))
        print(f"{beat_id}: wer {score:.2f}", flush=True)
        if score > args.max_wer:
            flagged.append((beat_id, score, heard))
    for beat_id, score, heard in flagged:
        print(f"\nFLAG {beat_id} (wer {score:.2f})\n  heard: {heard}")
    print(f"\n{len(flagged)} of {len(script['beats'])} clips flagged")


if __name__ == "__main__":
    main()

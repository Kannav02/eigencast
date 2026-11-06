"""Transcribe every clip of one video and flag ones that don't match the script.

TTS models sometimes skip, repeat, or garble words; this catches that without listening.
"""

import json
import re
from pathlib import Path

from mlx_audio.stt.utils import load_model

from .narrate import check_beat_ids

STT_MODEL = "mlx-community/parakeet-tdt-0.6b-v3"
# Commit SHA to download (None follows main); see MODEL_REVISIONS in voice.py.
STT_REVISION: str | None = None


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


def listen(video_dir: Path, max_wer: float = 0.15) -> dict:
    """Check every recorded clip.

    1. Load the script's spoken text per beat and the speech-to-text model.
    2. Transcribe audio/<beat>.wav for each beat that has a clip.
    3. Return word error rate per beat and the beats above the threshold.
    """
    script = json.loads((video_dir / "script.json").read_text())
    check_beat_ids(script["beats"])
    model = load_model(STT_MODEL, revision=STT_REVISION)
    scores, flagged = {}, []
    for beat_id, text in script["beats"].items():
        wav = video_dir / "audio" / f"{beat_id}.wav"
        if not wav.exists():
            continue
        heard = model.generate(str(wav)).text
        scores[beat_id] = round(wer(words(text), words(heard)), 3)
        print(f"{beat_id}: wer {scores[beat_id]:.2f}", flush=True)
        if scores[beat_id] > max_wer:
            flagged.append({"beat": beat_id, "wer": scores[beat_id], "heard": heard})
    return {"scores": scores, "flagged": flagged}

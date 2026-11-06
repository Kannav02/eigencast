"""Text in, audio out. Knows nothing about videos or beats.

A backend is picked from a script's "voice" settings. Today there is one: Qwen3-TTS on
Apple Silicon through mlx-audio, in "preset" (built-in speaker) or "clone" (copy a voice
from a reference recording) mode.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np
from mlx_audio.tts.utils import load_model

PRESET_MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit"
CLONE_MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16"
# Hugging Face commit SHAs to download, so a changed or compromised model repo can't swap the weights.
# None follows the repo's main branch. Fill in with:
#   curl -s https://huggingface.co/api/models/<repo>/revision/main | jq -r .sha
MODEL_REVISIONS: dict[str, str | None] = {PRESET_MODEL: None, CLONE_MODEL: None}


def inside(base: Path, rel: str, what: str) -> Path:
    """`base / rel`, refusing absolute paths and `..` that would leave `base`."""
    path = (base / rel).resolve()
    if Path(rel).is_absolute() or not path.is_relative_to(base.resolve()):
        raise SystemExit(f'script.json: "{what}" must be a path inside the video folder, got {rel!r}')
    return path


@dataclass
class Clip:
    audio: np.ndarray  # mono float32
    sample_rate: int

    @property
    def seconds(self) -> float:
        return len(self.audio) / self.sample_rate


class Voice(Protocol):
    def speak(self, text: str) -> Clip: ...


class QwenMlxVoice:
    """Qwen3-TTS via mlx-audio. Loads the model on first use (first run downloads it)."""

    def __init__(self, settings: dict, base_dir: Path):
        self.settings = settings
        self.base_dir = base_dir
        self.model = None

    def _load(self):
        mode = self.settings.get("mode", "preset")
        repo = CLONE_MODEL if mode == "clone" else PRESET_MODEL
        self.model = load_model(repo, revision=MODEL_REVISIONS[repo])

    def speak(self, text: str) -> Clip:
        """Synthesize one utterance.

        1. Load the model if needed.
        2. Clone mode: condition on the reference wav and its transcript.
           Preset mode: use the named speaker and optional style instruction.
        3. Join the generated chunks into one mono array.
        """
        if self.model is None:
            self._load()
        s = self.settings
        if s.get("mode") == "clone":
            ref_audio = inside(self.base_dir, s.get("ref_audio", "voice/ref.wav"), "ref_audio")
            ref_text = inside(self.base_dir, s.get("ref_text", "voice/ref.txt"), "ref_text")
            results = list(self.model.generate(text=text, ref_audio=str(ref_audio), ref_text=ref_text.read_text().strip()))
        else:
            results = list(self.model.generate_custom_voice(
                text=text,
                speaker=s.get("speaker", "Ryan"),
                language=s.get("language", "English"),
                instruct=s.get("instruct"),
            ))
        audio = np.concatenate([np.asarray(r.audio, dtype=np.float32) for r in results])
        return Clip(audio, results[0].sample_rate)


BACKENDS = {"qwen-mlx": QwenMlxVoice}


def get_voice(settings: dict, base_dir: Path) -> Voice:
    """Build the backend named by settings["backend"] (default qwen-mlx)."""
    name = settings.get("backend", "qwen-mlx")
    if name not in BACKENDS:
        raise SystemExit(f"Unknown voice backend {name!r}. Available: {', '.join(BACKENDS)}")
    return BACKENDS[name](settings, base_dir)

"""Record every beat of one video and write down how long each clip is.

Reads <video>/script.json, writes <video>/audio/<beat>.wav and <video>/timing.json.
Unchanged beats are skipped: each clip stores a fingerprint of its words and voice settings.
"""

import hashlib
import json
from pathlib import Path

import soundfile as sf

from .voice import get_voice


def clip_hash(text: str, voice: dict) -> str:
    """Fingerprint of the spoken text and voice settings, used to skip unchanged clips."""
    return hashlib.sha1(json.dumps([text, voice], sort_keys=True).encode()).hexdigest()[:12]


def plan(video_dir: Path, force: bool = False, only: list[str] | None = None) -> dict:
    """Decide which beats need recording without recording anything.

    1. Load the script and any existing timing.json.
    2. A beat is skipped only if its wav exists, its stored hash matches, and it is not forced.
    3. Beats in timing.json that are no longer in the script are listed as stale.
    """
    only = only or []
    script = json.loads((video_dir / "script.json").read_text())
    timing_path = video_dir / "timing.json"
    timing = json.loads(timing_path.read_text()) if timing_path.exists() else {"beats": {}}
    record, skip = [], []
    for beat_id, text in script["beats"].items():
        cached = timing["beats"].get(beat_id)
        fresh = not force and beat_id not in only
        wav = video_dir / "audio" / f"{beat_id}.wav"
        if fresh and wav.exists() and cached and cached.get("hash") == clip_hash(text, script["voice"]):
            skip.append(beat_id)
        else:
            reason = "forced" if not fresh else "no clip yet" if not (wav.exists() and cached) else "text or voice changed"
            record.append({"beat": beat_id, "reason": reason})
    stale = [b for b in timing["beats"] if b not in script["beats"]]
    return {"record": record, "skip": skip, "stale": stale}


def narrate(video_dir: Path, force: bool = False, only: list[str] | None = None) -> dict:
    """Record the beats that need it.

    1. Plan which beats to record.
    2. Speak each one, save its wav, store its seconds and hash (timing.json is saved after each clip).
    3. Drop timing entries for beats removed from the script.
    """
    todo = plan(video_dir, force, only)
    script = json.loads((video_dir / "script.json").read_text())
    voice_settings = script["voice"]
    timing_path = video_dir / "timing.json"
    timing = json.loads(timing_path.read_text()) if timing_path.exists() else {"beats": {}}
    audio_dir = video_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    voice = get_voice(voice_settings, video_dir) if todo["record"] else None
    for item in todo["record"]:
        beat_id = item["beat"]
        clip = voice.speak(script["beats"][beat_id])
        sf.write(audio_dir / f"{beat_id}.wav", clip.audio, clip.sample_rate)
        timing["beats"][beat_id] = {"seconds": round(clip.seconds, 3), "hash": clip_hash(script["beats"][beat_id], voice_settings)}
        timing_path.write_text(json.dumps(timing, indent=2) + "\n")
        print(f"{beat_id}: {clip.seconds:.2f}s", flush=True)

    for beat_id in todo["stale"]:
        del timing["beats"][beat_id]
    order = list(script["beats"])
    timing["beats"] = {b: timing["beats"][b] for b in order if b in timing["beats"]}
    timing_path.write_text(json.dumps(timing, indent=2) + "\n")
    total = sum(b["seconds"] for b in timing["beats"].values())
    return {"recorded": [i["beat"] for i in todo["record"]], "skipped": todo["skip"], "clips": len(timing["beats"]), "seconds": round(total, 2)}

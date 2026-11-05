"""Command line for the voice package. The eigencast CLI calls this; people rarely need to.

    eigencast-voice narrate <video-dir> [--force] [--only s1b2 ...] [--plan]
    eigencast-voice listen  <video-dir> [--max-wer 0.15]

The last line of output is always one JSON object with the result.
"""

import argparse
import json
from pathlib import Path

from .listen import listen
from .narrate import narrate, plan


def main() -> None:
    parser = argparse.ArgumentParser(prog="eigencast-voice")
    sub = parser.add_subparsers(dest="cmd", required=True)
    n = sub.add_parser("narrate", help="record changed beats")
    n.add_argument("video_dir", type=Path)
    n.add_argument("--force", action="store_true", help="re-record every beat")
    n.add_argument("--only", nargs="*", default=[], help="beat ids to re-record")
    n.add_argument("--plan", action="store_true", help="only report which beats would be recorded")
    li = sub.add_parser("listen", help="transcribe clips and flag mismatches")
    li.add_argument("video_dir", type=Path)
    li.add_argument("--max-wer", type=float, default=0.15)
    args = parser.parse_args()

    if not (args.video_dir / "script.json").exists():
        raise SystemExit(f"{args.video_dir}/script.json not found")
    if args.cmd == "narrate":
        result = plan(args.video_dir, args.force, args.only) if args.plan else narrate(args.video_dir, args.force, args.only)
    else:
        result = listen(args.video_dir, args.max_wer)
    print(json.dumps(result))


if __name__ == "__main__":
    main()

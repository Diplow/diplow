"""From captions to a Raw's text: timed segments grouped into 30-second blocks.

Taken out of the legacy `batch_transcripts.py`, so a fetched Raw reads like the ones copied from
Drive: a frontmatter holding `youtube_id`, then blocks two blank lines apart, each a `m:ss` line
(`h:mm:ss` past an hour), a blank line and the text said from that moment.
"""

from __future__ import annotations

import json
import re

Segment = tuple[int, str]
"""When a caption starts, in milliseconds, and what it says."""

BLOCK_SECONDS = 30

VTT_CUE = re.compile(r"(\d+):(\d{2}):(\d{2})\.(\d{3})\s*-->")
VTT_TAG = re.compile(r"<[^>]+>")


def parse_json3(text: str) -> list[Segment]:
    """YouTube's own caption format: `events`, each with a start and text `segs`."""
    segments = []
    for event in json.loads(text).get("events", []):
        if "segs" not in event:
            continue
        caption = "".join(seg.get("utf8", "") for seg in event["segs"])
        caption = caption.replace("\n", " ").strip()
        if caption:
            segments.append((int(event.get("tStartMs", 0)), caption))
    return segments


def parse_vtt(text: str) -> list[Segment]:
    """WebVTT, the fallback when YouTube serves no json3: one cue per blank-line block."""
    segments = []
    for block in re.split(r"\n\n+", text.replace("\r\n", "\n")):
        lines = block.strip().split("\n")
        for i, line in enumerate(lines):
            cue = VTT_CUE.match(line)
            if cue:
                h, m, s, ms = (int(part) for part in cue.groups())
                caption = " ".join(VTT_TAG.sub("", " ".join(lines[i + 1 :])).split())
                if caption:
                    segments.append(((h * 3600 + m * 60 + s) * 1000 + ms, caption))
                break
    return segments


def timestamp(ms: int) -> str:
    seconds = ms // 1000
    h, m, s = seconds // 3600, seconds % 3600 // 60, seconds % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def blocks(segments: list[Segment]) -> list[tuple[int, str]]:
    """Consecutive segments joined until one starts 30 s or more after the block began."""
    grouped: list[tuple[int, list[str]]] = []
    for start, caption in segments:
        if not grouped or start - grouped[-1][0] >= BLOCK_SECONDS * 1000:
            grouped.append((start, []))
        grouped[-1][1].append(caption)
    return [(start, " ".join(captions)) for start, captions in grouped]


def build_raw(youtube_id: str, segments: list[Segment]) -> str:
    # Blocks two blank lines apart, as batch_transcripts.py wrote them.
    body = "\n".join(f"\n{timestamp(start)}\n\n{text}\n" for start, text in blocks(segments))
    return f"---\nyoutube_id: {youtube_id}\n---\n{body}"

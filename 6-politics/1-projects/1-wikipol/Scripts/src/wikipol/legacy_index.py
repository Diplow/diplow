"""What a frozen vault knows about its Raws: which YouTube id and date go with a transcript.

The transcripts on Google Drive are named after their video's title, and most carry a
`youtube_id` in their frontmatter, but not all, and none carries its publication date. The
legacy vaults fill part of that gap, read-only:

- a Videos note has the video's `youtube_id` and `date`, and links its transcript under
  `## Transcript`;
- an inventory table (Boniface's) has one row per video: title, `watch?v=` URL, date, and a
  link to the transcript once there is one.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

import yaml

from wikipol.raw_store import YOUTUBE_ID

WATCH_URL = re.compile(r"watch\?v=([A-Za-z0-9_-]{11})")
ISO_DATE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")
WIKILINK = re.compile(r"\[\[([^\]|#]+)")
BACKTICK_PATH = re.compile(r"`([^`]+\.md)`")
TRANSCRIPT_DIR = "Sources/Transcripts/"

FRENCH_MONTHS = {
    "janvier": 1,
    "février": 2,
    "fevrier": 2,
    "mars": 3,
    "avril": 4,
    "mai": 5,
    "juin": 6,
    "juillet": 7,
    "août": 8,
    "aout": 8,
    "septembre": 9,
    "octobre": 10,
    "novembre": 11,
    "décembre": 12,
    "decembre": 12,
}


def split_frontmatter(text: str) -> tuple[dict, str]:
    """The YAML frontmatter as a dict (empty when absent or unreadable), and the body."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    block = text[3:end]
    try:
        data = yaml.safe_load(block)
    except (yaml.YAMLError, ValueError):  # ValueError: a date YAML reads but can't build
        data = _flat_frontmatter(block)
    body = text[end + 4 :].lstrip("-")
    return (data if isinstance(data, dict) else {}), body


def _flat_frontmatter(block: str) -> dict:
    """`key: value` lines as strings, for a frontmatter YAML refuses."""
    data = {}
    for line in block.splitlines():
        match = re.match(r"^([\w][\w ]*):\s*(.*?)\s*$", line)
        if match:
            data[match.group(1)] = match.group(2).strip("\"'")
    return data


def parse_date(value: object) -> date | None:
    """A date written as YAML parses it, as `YYYY-MM-DD`, or in French (`30 mars 2026`)."""
    if isinstance(value, datetime):  # YAML reads `2025-07-27 10:00` as a datetime
        return value.date()
    if isinstance(value, date):
        return value
    if not isinstance(value, str):
        return None
    iso = ISO_DATE.search(value)
    if iso:
        try:
            return date.fromisoformat(iso.group(1))
        except ValueError:
            return None
    match = re.fullmatch(r"\s*(\d{1,2})(?:er)?\s+(\w+)\s+(\d{4})\s*", value.lower())
    if match and match.group(2) in FRENCH_MONTHS:
        try:
            return date(int(match.group(3)), FRENCH_MONTHS[match.group(2)], int(match.group(1)))
        except ValueError:
            return None
    return None


def transcript_stem(target: str) -> str:
    """`Sources/Transcripts/Foo.md` and `Foo` both name the transcript `Foo`."""
    target = target.strip()
    target = target.removeprefix(TRANSCRIPT_DIR)
    return target.removesuffix(".md").strip()


@dataclass
class LegacyIndex:
    id_by_transcript: dict[str, str] = field(default_factory=dict)
    published_by_id: dict[str, date] = field(default_factory=dict)
    # Transcripts two entries tie to different ids: left out of id_by_transcript.
    ambiguous: set[str] = field(default_factory=set)

    def add(self, transcript: str | None, youtube_id: str, published: date | None) -> None:
        if published and youtube_id not in self.published_by_id:
            self.published_by_id[youtube_id] = published
        if not transcript or transcript in self.ambiguous:
            return
        known = self.id_by_transcript.get(transcript)
        if known and known != youtube_id:
            del self.id_by_transcript[transcript]
            self.ambiguous.add(transcript)
        else:
            self.id_by_transcript[transcript] = youtube_id


def build_index(vault: Path | None, inventory: Path | None = None) -> LegacyIndex:
    index = LegacyIndex()
    if vault is None:
        return index
    for note in sorted((vault / "Videos").glob("*.md")):
        _index_video_note(index, note.read_text(encoding="utf-8"))
    if inventory is not None and inventory.is_file():
        _index_inventory(index, inventory.read_text(encoding="utf-8"))
    return index


def _index_video_note(index: LegacyIndex, text: str) -> None:
    frontmatter, body = split_frontmatter(text)
    youtube_id = str(frontmatter.get("youtube_id") or "").strip()
    if not YOUTUBE_ID.fullmatch(youtube_id):
        return
    # Some notes repeat `date:`, a full one then a partial one (`2025-04`); YAML keeps the last.
    published = parse_date(frontmatter.get("date")) or _first_date_line(text)
    section = re.search(r"^## Transcript\s*$(.*?)(?=^## |\Z)", body, re.M | re.S)
    links: set[str] = set()
    if section:
        text = section.group(1)
        links = {transcript_stem(t) for t in WIKILINK.findall(text) + BACKTICK_PATH.findall(text)}
    if not links:
        index.add(None, youtube_id, published)
    for link in links:
        index.add(link, youtube_id, published)


def _first_date_line(text: str) -> date | None:
    end = text.find("\n---", 3)
    for value in re.findall(r"^date:\s*(.+)$", text[: max(end, 0)], re.M):
        published = parse_date(value.strip().strip("\"'"))
        if published:
            return published
    return None


def _index_inventory(index: LegacyIndex, text: str) -> None:
    for line in text.splitlines():
        url = WATCH_URL.search(line)
        if not line.lstrip().startswith("|") or not url:
            continue
        # The title cell can hold a `|` of its own, so read the cells after the URL only:
        # the rest of the URL cell, then Date, Transcript and Fiche.
        cells = line[url.end() :].split("|")
        published_match = ISO_DATE.search(cells[1]) if len(cells) > 1 else None
        link = WIKILINK.search(cells[2]) if len(cells) > 2 else None
        index.add(
            transcript_stem(link.group(1)) if link else None,
            url.group(1),
            parse_date(published_match.group(1)) if published_match else None,
        )


@dataclass(frozen=True)
class LegacyNote:
    """A frozen vault's Videos note on one Publication: extra input for its Digest."""

    path: Path
    text: str
    published: date | None


def find_video_note(vault: Path | None, youtube_id: str) -> LegacyNote | None:
    """The vault's Videos note whose frontmatter names `youtube_id`, if there is one."""
    if vault is None:
        return None
    for note in sorted((vault / "Videos").glob("*.md")):
        text = note.read_text(encoding="utf-8")
        frontmatter, _ = split_frontmatter(text)
        if str(frontmatter.get("youtube_id") or "").strip() == youtube_id:
            published = parse_date(frontmatter.get("date")) or _first_date_line(text)
            return LegacyNote(note, text, published)
    return None

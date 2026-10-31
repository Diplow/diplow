"""A Raw as blocks of text, each with the second it starts at, and where a quote sits in them.

Most Raws are 30-second blocks: a `m:ss` line (`h:mm:ss` past an hour), then what was said. A
few copied from Drive open each block with `**[MM:SS](https://www.youtube.com/watch?v=ID&t=N)**`
under a title and a URL, and some carry no timestamp at all (decisions.md#DEC-8). A Raw without
any timestamp is one untimed block, and none of its Extracts can carry a link.

A quote is matched on its words: case, accents' composition and punctuation aside, since captions
punctuate loosely. The words must follow each other in the Raw, and the first one must sit in the
block the Extract links to; the quote may run on into the next blocks.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from wikipol.legacy_index import split_frontmatter

CLOCK = re.compile(r"(?:(\d+):)?(\d{1,2}):(\d{2})")
PLAIN_START = re.compile(rf"^\s*({CLOCK.pattern})\s*$")
LINKED_START = re.compile(rf"^\s*\*\*\[({CLOCK.pattern})\]\([^)]*?[?&]t=(\d+)s?\)\*\*\s*$")
NOT_A_WORD = re.compile(r"[\W_]+")


def clock_seconds(label: str) -> int | None:
    """`12:34` and `1:02:03` in seconds; None for anything else."""
    match = CLOCK.fullmatch(label.strip())
    if not match:
        return None
    hours, minutes, seconds = (int(part or 0) for part in match.groups())
    if seconds >= 60 or (hours and minutes >= 60):
        return None
    return hours * 3600 + minutes * 60 + seconds


def clock(seconds: int) -> str:
    """The label a Raw gives a block: `m:ss`, `h:mm:ss` past an hour."""
    h, m, s = seconds // 3600, seconds % 3600 // 60, seconds % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def words(text: str) -> str:
    """The text's words, lowercased and space-separated: what a quote is matched on."""
    text = unicodedata.normalize("NFKC", text).casefold()
    return " ".join(NOT_A_WORD.sub(" ", text).split())


@dataclass(frozen=True)
class Block:
    start: int | None
    """Seconds into the video; None for text before the first timestamp, or a Raw without any."""
    text: str


@dataclass(frozen=True)
class RawText:
    blocks: tuple[Block, ...]

    @property
    def timed(self) -> bool:
        return any(block.start is not None for block in self.blocks)

    @property
    def starts(self) -> set[int]:
        return {block.start for block in self.blocks if block.start is not None}

    def holds(self, quote: str, at: int | None = None) -> bool:
        """Whether the quote's words are in the Raw, starting in a block that starts at `at`
        seconds; anywhere when `at` is None."""
        needle = f" {words(quote)} "
        if not needle.strip():
            return False
        # Every block's words, one space apart, with where each block begins and ends.
        spans, parts, offset = [], [], 1
        for block in self.blocks:
            text = words(block.text)
            spans.append((offset, offset + len(text), block.start))
            parts.append(text)
            offset += len(text) + 1
        haystack = f" {' '.join(parts)} "
        found = haystack.find(needle)
        while found != -1:
            first_word = found + 1
            if at is None or any(
                start == at and begin <= first_word < end for begin, end, start in spans
            ):
                return True
            found = haystack.find(needle, found + 1)
        return False


def parse_raw(body: str) -> RawText:
    """The Raw's blocks, its frontmatter left out."""
    _, text = split_frontmatter(body.replace("\r\n", "\n"))
    blocks: list[Block] = []
    start: int | None = None
    lines: list[str] = []

    def close() -> None:
        content = " ".join(" ".join(lines).split())
        if content or start is not None:
            blocks.append(Block(start, content))

    for line in text.split("\n"):
        plain, linked = PLAIN_START.match(line), LINKED_START.match(line)
        seconds = None
        if linked:
            seconds = int(linked.group(5))
        elif plain:
            seconds = clock_seconds(plain.group(1))
        if seconds is None:
            lines.append(line)
            continue
        close()
        start, lines = seconds, []
    close()
    return RawText(tuple(blocks))

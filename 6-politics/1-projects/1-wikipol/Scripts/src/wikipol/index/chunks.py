"""A Raw cut into the chunks the index embeds: about two minutes of speech each, keeping the
seconds they start and end at, so a search hit links back into the video.

A chunk gathers the Raw's 30-second blocks until it spans CHUNK_SECONDS, and the next chunk starts
on its last block, so two neighbors share one block (about 30 s) and a sentence cut at a chunk's
edge is whole in one of them. Blocks are gathered by their timestamps, not counted, since the few
Raws in the `**[MM:SS]**` shape don't keep to 30 s (decisions.md#DEC-8). Text before a timed
Raw's first timestamp is the title-and-URL header of that shape, not speech, and is left out.

A Raw without any timestamp (one untimed block) is cut by words instead, UNTIMED_WORDS at a time
with UNTIMED_OVERLAP_WORDS shared, and its chunks carry no seconds. So is a timed chunk past
MAX_WORDS, a block whose timestamps are too sparse for two minutes to stay short: its pieces keep
the chunk's seconds, so no input outgrows what the embedding model reads.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from wikipol.digest.raw_text import Block, RawText

CHUNKING = 1
"""The version of these rules: a Publication indexed under another is chunked again."""
CHUNK_SECONDS = 120
BLOCK_SECONDS = 30
"""How long a Raw's last block is taken to last when the video's duration is unknown."""
# About two minutes and thirty seconds of speech: a 30-second block holds about 110 words.
UNTIMED_WORDS = 440
UNTIMED_OVERLAP_WORDS = 110
MAX_WORDS = 2000
"""About 2 800 tokens, far under qwen3-embedding-8b's 32k; the longest chunk of the bucket on
2026-10-31 held 641 words."""


@dataclass(frozen=True)
class Chunk:
    position: int
    """0 for the first chunk of the Raw, then 1, 2…"""
    start: int | None
    """Seconds into the video; None for a Raw without timestamps."""
    end: int | None
    text: str


def chunk_raw(raw_text: RawText, duration: int | None = None) -> list[Chunk]:
    """The Raw's chunks, in order; none when it holds no words."""
    timed = [block for block in raw_text.blocks if block.start is not None]
    if not timed:
        return _untimed_chunks(" ".join(block.text for block in raw_text.blocks))
    pieces = [
        replace(piece, start=chunk.start, end=chunk.end)
        for chunk in _timed_chunks(timed, duration)
        for piece in (
            _untimed_chunks(chunk.text) if len(chunk.text.split()) > MAX_WORDS else [chunk]
        )
    ]
    return [replace(piece, position=n) for n, piece in enumerate(pieces)]


def _timed_chunks(blocks: list[Block], duration: int | None) -> list[Chunk]:
    blocks = sorted(blocks, key=lambda block: block.start or 0)
    last_start = blocks[-1].start or 0
    video_end = duration if duration is not None and duration >= last_start else None
    raw_end = video_end if video_end is not None else last_start + BLOCK_SECONDS

    def end_of(index: int) -> int:
        """Where the block at `index` ends: where the next one starts, or the Raw's end."""
        if index + 1 < len(blocks):
            return blocks[index + 1].start or 0
        return raw_end

    chunks: list[Chunk] = []
    first = 0
    while True:
        last = first
        while last + 1 < len(blocks) and end_of(last) - (blocks[first].start or 0) < CHUNK_SECONDS:
            last += 1
        text = " ".join(block.text for block in blocks[first : last + 1] if block.text)
        if text:
            chunks.append(Chunk(len(chunks), blocks[first].start, end_of(last), text))
        if last + 1 >= len(blocks):
            return chunks
        # The next chunk opens on this one's last block, unless that block is the whole of this
        # chunk or long enough to be a chunk of its own.
        shared = last > first and end_of(last) - (blocks[last].start or 0) < CHUNK_SECONDS
        first = last if shared else last + 1


def _untimed_chunks(text: str) -> list[Chunk]:
    words = text.split()
    chunks: list[Chunk] = []
    step = UNTIMED_WORDS - UNTIMED_OVERLAP_WORDS
    for begin in range(0, len(words), step):
        chunks.append(
            Chunk(len(chunks), None, None, " ".join(words[begin : begin + UNTIMED_WORDS]))
        )
        if begin + UNTIMED_WORDS >= len(words):
            break
    return chunks

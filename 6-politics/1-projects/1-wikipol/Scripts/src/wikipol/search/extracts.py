"""A question in, the passages of the Raws nearest it out, each as an Extract: the passage, its
`watch?v=ID&t=Ns` link, its Publication's title and date, and the path of its Digest.

The question is embedded with the instruction qwen3-embedding-8b takes for a query (the chunks
were embedded without one, decisions.md#DEC-20), then the index keeps the chunks of the Source and
the period asked for and ranks them by cosine similarity. A period's bounds may be a year, a
month or a day: `from` starts on the first day of it, `to` ends on the last. A Publication without
a date is found by a search without a period only.
"""

from __future__ import annotations

import calendar
import re
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Protocol

from wikipol.digest.format import watch_url
from wikipol.digest.raw_text import clock
from wikipol.index.embed import Embedder
from wikipol.index.store import Hit

QUERY_INSTRUCTION = (
    "Given a subject and the period it is asked about, retrieve passages of French political "
    "video transcripts that discuss that subject"
)
"""qwen3-embedding-8b's queries take a one-line task, in English whatever their language."""
DEFAULT_LIMIT = 8
MAX_LIMIT = 25
QUERY_TIMEOUT_SECONDS = 20
QUERY_RETRY_PAUSES = (2,)
"""An agent waits on the query's embedding: two tries of 20 s at most, where indexing waits out
a busy API for minutes."""
PERIOD_BOUND = re.compile(r"(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?")


class SearchFailed(Exception):
    """The search couldn't run; the message says why, for the agent that asked."""


class SearchRefused(SearchFailed):
    """The question can't be searched as asked: an empty query, an unknown Source, a bad date."""


class SearchableIndex(Protocol):
    def nearest(
        self,
        embedding: Sequence[float],
        model: str,
        *,
        source: str | None = None,
        start: date | None = None,
        end: date | None = None,
        limit: int,
    ) -> list[Hit]: ...


@dataclass(frozen=True)
class Extract:
    passage: str
    url: str
    """Into the video at the passage's first second; at its start for a Raw without timestamps."""
    at: str | None
    """The passage's first second as the Digests write it, `12:30`; None without timestamps."""
    title: str
    published: date | None
    digest: str | None
    """The repo path of the Publication's Digest, once its Chronicle holds one."""
    source: str
    similarity: float

    def as_json(self) -> dict[str, object]:
        return {
            "passage": self.passage,
            "url": self.url,
            "at": self.at,
            "title": self.title,
            "published": self.published.isoformat() if self.published else None,
            "digest": self.digest,
            "source": self.source,
            "similarity": round(self.similarity, 3),
        }


def query_text(query: str) -> str:
    return f"Instruct: {QUERY_INSTRUCTION}\nQuery:{query}"


def period_bound(text: str, *, last: bool) -> date:
    """`2025`, `2025-03` or `2025-03-14` as a day: the first of the stretch, or with `last` the
    last of it."""
    match = PERIOD_BOUND.fullmatch(text.strip())
    if match is None:
        raise SearchRefused(f"{text!r} is not a date: write 2025, 2025-03 or 2025-03-14")
    year, month, day = (int(group) if group else None for group in match.groups())
    try:
        if month is None:
            return date(year, 12, 31) if last else date(year, 1, 1)
        if day is None:
            return date(year, month, calendar.monthrange(year, month)[1] if last else 1)
        return date(year, month, day)
    except ValueError as error:
        raise SearchRefused(f"{text!r} is not a date: {error}") from error


def find_extracts(
    query: str,
    embedder: Embedder,
    index: SearchableIndex,
    *,
    sources: Sequence[str],
    source: str | None = None,
    start: str | None = None,
    end: str | None = None,
    limit: int | None = None,
) -> list[Extract]:
    """The Extracts nearest `query`, nearest first. `sources` are the slugs a `source` may name."""
    if not query.strip():
        raise SearchRefused("the query is empty")
    if source is not None and source not in sources:
        raise SearchRefused(f"no Source {source!r}; the Sources are {', '.join(sources)}")
    first = None if start is None else period_bound(start, last=False)
    last = None if end is None else period_bound(end, last=True)
    if first and last and first > last:
        raise SearchRefused(f"the period ends ({end}) before it starts ({start})")
    limit = DEFAULT_LIMIT if limit is None else limit
    if not 1 <= limit <= MAX_LIMIT:
        raise SearchRefused(f"limit must be between 1 and {MAX_LIMIT}, not {limit}")
    [vector] = embedder.embed([query_text(query)]).vectors
    hits = index.nearest(vector, embedder.model, source=source, start=first, end=last, limit=limit)
    return [
        Extract(
            passage=hit.chunk.text,
            url=watch_url(hit.publication.youtube_id, hit.chunk.start),
            at=clock(hit.chunk.start) if hit.chunk.start is not None else None,
            title=hit.publication.title,
            published=hit.publication.published,
            digest=hit.publication.digest_path,
            source=hit.publication.source,
            similarity=1 - hit.distance,
        )
        for hit in hits
    ]

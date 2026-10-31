"""`wikipol index`: put a Source's Raws in the search index, the ones it lacks only.

A Raw is indexed once, as a Publication (its title, date, duration, object key and, once there
is one, its Digest's path) and as chunks with their embeddings. A run skips every Publication
already indexed with today's model and chunking, so re-running indexes only what is new; it still
updates their Digest path, which moves as the Chronicle files and splits.

The date is the one a Digest carries: the Raw's `published`, else its legacy note's `date`, else
unknown. A Publication without a date is still indexed, and found by meaning, not by date. A Raw
without a word to index is a Publication without chunks.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from wikipol.backfill import chronicle_digests
from wikipol.config import Source
from wikipol.digest.raw_text import parse_raw
from wikipol.index.chunks import CHUNKING, chunk_raw
from wikipol.index.embed import Embedder, EmbeddingFailed, cost_eur
from wikipol.index.store import EmbeddedChunk, IndexStore, Publication
from wikipol.legacy_index import video_notes
from wikipol.raw_store import RawStore, raw_key

TOKENS_PER_WORD = 1.42
"""What a dry run estimates the API would count per word of French captions. Measured with
qwen3-embedding-8b's tokenizer on PaduTeam's Raws (decisions.md#DEC-20)."""


@dataclass
class IndexReport:
    source: str
    raws: int = 0
    up_to_date: int = 0
    relinked: int = 0
    """Indexed Publications whose Digest path changed this run."""
    indexed: list[str] = field(default_factory=list)
    """Publications indexed this run; in a dry run, the ones it would index."""
    chunks: int = 0
    words: int = 0
    tokens: int = 0
    """As the API counted them; 0 in a dry run."""
    undated: list[str] = field(default_factory=list)
    """Of `indexed`, those without a known date."""
    empty: list[str] = field(default_factory=list)
    """Raws without a word to index, or not readable as UTF-8: Publications without chunks."""
    left: int = 0
    """Raws still to index after the run, when `limit` or a failure stopped it."""
    stopped: str | None = None


def index_source(
    source: Source,
    raws: RawStore,
    embedder: Embedder,
    index: IndexStore,
    *,
    repo_root: Path,
    limit: int | None = None,
    dry_run: bool = False,
    log: Callable[[str], None] = lambda line: None,
) -> IndexReport:
    report = IndexReport(source.slug)
    indexed = index.indexed(source.slug)
    digests = {
        youtube_id: f"{where}.md"
        for youtube_id, (where, _, _) in chronicle_digests(source, repo_root).items()
    }
    ids = raws.list(source.slug)
    report.raws = len(ids)
    todo: list[str] = []
    for youtube_id in ids:
        current = indexed.get(youtube_id)
        if current is None or (current.embedding_model, current.chunking) != (
            embedder.model,
            CHUNKING,
        ):
            todo.append(youtube_id)
            continue
        report.up_to_date += 1
        digest_path = digests.get(youtube_id)
        if current.digest_path != digest_path:
            report.relinked += 1
            if not dry_run:
                index.set_digest_path(source.slug, youtube_id, digest_path)

    notes = video_notes(source.legacy_vault) if todo else {}
    for done, youtube_id in enumerate(todo):
        # The limit counts Raws embedded: one without words costs no call.
        if limit is not None and len(report.indexed) >= limit:
            report.left = len(todo) - done
            break
        raw = raws.get(source.slug, youtube_id)
        try:
            chunks = chunk_raw(parse_raw(raw.body.decode("utf-8")), raw.meta.duration)
        except UnicodeDecodeError:
            chunks = []
        note = notes.get(youtube_id)
        publication = Publication(
            source=source.slug,
            youtube_id=youtube_id,
            title=raw.meta.title,
            published=raw.meta.published or (note.published if note else None),
            duration=raw.meta.duration,
            raw_key=raw_key(source.slug, youtube_id),
            digest_path=digests.get(youtube_id),
            embedding_model=embedder.model,
            chunking=CHUNKING,
        )
        if not chunks:
            # A Publication all the same, so the next run doesn't read its Raw again.
            if not dry_run:
                index.put(publication, [])
            report.empty.append(youtube_id)
            continue
        words = sum(len(chunk.text.split()) for chunk in chunks)
        if not dry_run:
            try:
                embeddings = embedder.embed([chunk.text for chunk in chunks])
            except EmbeddingFailed as error:
                report.stopped = f"{youtube_id}: {error}"
                report.left = len(todo) - done
                break
            index.put(
                publication,
                [EmbeddedChunk(c, v) for c, v in zip(chunks, embeddings.vectors, strict=True)],
            )
            report.tokens += embeddings.tokens
            log(f"{source.slug}/{youtube_id}: {len(chunks)} chunks, {embeddings.tokens} tokens")
        report.indexed.append(youtube_id)
        report.chunks += len(chunks)
        report.words += words
        if publication.published is None:
            report.undated.append(youtube_id)
    return report


def format_report(reports: list[IndexReport], dry_run: bool = False) -> str:
    lines = []
    for r in reports:
        verb = "to index" if dry_run else "indexed"
        line = (
            f"{r.source}: {r.raws} Raws, {r.up_to_date} already indexed, {len(r.indexed)} {verb}"
            f" ({r.chunks} chunks, {r.words} words"
        )
        line += ")" if dry_run else f", {r.tokens} tokens)"
        line += f", {len(r.undated)} of them without a date, {len(r.empty)} without words"
        if r.relinked:
            line += f", {r.relinked} Digest paths {'to update' if dry_run else 'updated'}"
        if r.left:
            line += f", {r.left} left for a later run"
        lines.append(line)
        lines.extend(f"  without a date: {youtube_id}" for youtube_id in r.undated)
        lines.extend(f"  without words: {youtube_id}" for youtube_id in r.empty)
        if r.stopped:
            lines.append(f"  stopped: {r.stopped}")
    if dry_run:
        tokens = round(sum(r.words for r in reports) * TOKENS_PER_WORD)
        lines.append(f"about {tokens} tokens to embed, about {cost_eur(tokens):.2f} EUR")
    else:
        tokens = sum(r.tokens for r in reports)
        lines.append(f"{tokens} tokens embedded, about {cost_eur(tokens):.2f} EUR")
    return "\n".join(lines)

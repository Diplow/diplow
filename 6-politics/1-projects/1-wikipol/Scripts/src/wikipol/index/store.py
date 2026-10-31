"""Where the index lives: Scaleway Serverless SQL, PostgreSQL with pgvector (docs/adr/0003).

A Publication and its chunks are written in one transaction, replacing what the index held for
it, so a run stopped halfway leaves every Publication either whole or absent, and the next run
takes up the absent ones. The schema is the SQL files of `migrations/`, applied once each, in
the order of their names, and recorded in `schema_migration`.

Applying it takes a role that may create tables. On Serverless SQL the pipeline's key connects as
`role_readwrite`, which only writes rows, so `wikipol migrate` runs once with a key that may (its
connection string in an env file of its own, named by `WIKIPOL_ENV`, not on a command line), and
the migration grants the rows to `role_readwrite`; `wikipol index` then finds nothing pending.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import date
from importlib import resources
from typing import Any, Protocol

from wikipol.index.chunks import Chunk

# Taken for the length of a migration, so two runs starting together don't both apply one.
MIGRATION_LOCK = 0x77696B69


class SchemaNotApplied(Exception):
    """The database lacks a migration, and the role connected may not apply it."""


@dataclass(frozen=True)
class Publication:
    source: str
    youtube_id: str
    title: str
    published: date | None
    duration: int | None
    raw_key: str
    digest_path: str | None
    embedding_model: str
    chunking: int


@dataclass(frozen=True)
class EmbeddedChunk:
    chunk: Chunk
    embedding: list[float]


@dataclass(frozen=True)
class Hit:
    """A chunk a search found, with its Publication and how far it lies from the query."""

    publication: Publication
    chunk: Chunk
    distance: float
    """Cosine distance: 0 for a chunk pointing the query's way, 2 for the opposite way."""


class IndexStore(Protocol):
    def indexed(self, source: str) -> dict[str, Publication]:
        """The Source's Publications in the index, by youtube_id."""
        ...

    def put(self, publication: Publication, chunks: Sequence[EmbeddedChunk]) -> None:
        """Index a Publication with its chunks, replacing what the index held for it."""
        ...

    def set_digest_path(self, source: str, youtube_id: str, digest_path: str | None) -> None: ...


class InMemoryIndex:
    """The index the tests use: same contract, two dicts for a database."""

    def __init__(self) -> None:
        self.publications: dict[tuple[str, str], Publication] = {}
        self.chunks: dict[tuple[str, str], list[EmbeddedChunk]] = {}

    def indexed(self, source: str) -> dict[str, Publication]:
        return {yid: p for (slug, yid), p in self.publications.items() if slug == source}

    def put(self, publication: Publication, chunks: Sequence[EmbeddedChunk]) -> None:
        key = (publication.source, publication.youtube_id)
        self.publications[key] = publication
        self.chunks[key] = list(chunks)

    def set_digest_path(self, source: str, youtube_id: str, digest_path: str | None) -> None:
        key = (source, youtube_id)
        self.publications[key] = replace(self.publications[key], digest_path=digest_path)

    def nearest(
        self,
        embedding: Sequence[float],
        model: str,
        *,
        source: str | None = None,
        start: date | None = None,
        end: date | None = None,
        limit: int,
    ) -> list[Hit]:
        hits = [
            Hit(publication, c.chunk, cosine_distance(embedding, c.embedding))
            for key, publication in self.publications.items()
            if publication.embedding_model == model
            and (source is None or publication.source == source)
            and within(publication.published, start, end)
            for c in self.chunks[key]
        ]
        return sorted(hits, key=lambda hit: hit.distance)[:limit]


def within(published: date | None, start: date | None, end: date | None) -> bool:
    """Whether a Publication falls in the period; one without a date falls in no bounded one."""
    if start is None and end is None:
        return True
    if published is None:
        return False
    return (start is None or published >= start) and (end is None or published <= end)


def cosine_distance(a: Sequence[float], b: Sequence[float]) -> float:
    """pgvector's `<=>`."""
    return 1 - sum(x * y for x, y in zip(a, b, strict=True)) / (math.hypot(*a) * math.hypot(*b))


def migrations() -> list[tuple[str, str]]:
    """The schema's SQL files, (name, SQL), in the order they apply."""
    folder = resources.files("wikipol.index") / "migrations"
    files = sorted(
        (entry for entry in folder.iterdir() if entry.name.endswith(".sql")),
        key=lambda f: f.name,
    )
    return [(entry.name, entry.read_text(encoding="utf-8")) for entry in files]


def vector_literal(embedding: Sequence[float]) -> str:
    """A vector as pgvector reads it in text: `[0.1,-0.2,…]`."""
    return "[" + ",".join(repr(float(x)) for x in embedding) + "]"


class PostgresIndex:
    def __init__(self, connection: Any) -> None:
        self.connection = connection

    @classmethod
    def connect(cls, database_url: str) -> PostgresIndex:
        import psycopg

        return cls(psycopg.connect(database_url))

    def close(self) -> None:
        self.connection.close()

    def _applied(self) -> set[str]:
        exists = self.connection.execute("SELECT to_regclass('schema_migration')").fetchone()
        if exists is None or exists[0] is None:
            return set()
        return {row[0] for row in self.connection.execute("SELECT name FROM schema_migration")}

    def pending(self) -> list[str]:
        """The migrations the database lacks, read without writing anything, so a key that may
        only write rows can still tell that the schema is up to date."""
        with self.connection.transaction():
            applied = self._applied()
        return [name for name, _ in migrations() if name not in applied]

    def migrate(self) -> list[str]:
        """Apply the migrations the database lacks; returns their names."""
        import psycopg

        if not self.pending():
            return []
        applied: list[str] = []
        try:
            with self.connection.transaction():
                self.connection.execute("SELECT pg_advisory_xact_lock(%s)", (MIGRATION_LOCK,))
                self.connection.execute(
                    "CREATE TABLE IF NOT EXISTS schema_migration ("
                    " name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
                )
                done = self._applied()
                for name, sql in migrations():
                    if name in done:
                        continue
                    self.connection.execute(sql)
                    self.connection.execute(
                        "INSERT INTO schema_migration (name) VALUES (%s)", (name,)
                    )
                    applied.append(name)
        except psycopg.errors.InsufficientPrivilege as error:
            raise SchemaNotApplied(
                "the database's role may not create the index's tables "
                f"({error.diag.message_primary}); apply the schema once with a key that may: "
                "write its connection string as WIKIPOL_DATABASE_URL in an env file of its own, "
                "then `WIKIPOL_ENV=<that file> uv run wikipol migrate`. On Serverless SQL, a key "
                "holding ServerlessSQLDatabaseReadWrite; the pipeline's DataReadWrite only "
                "writes rows"
            ) from error
        return applied

    def indexed(self, source: str) -> dict[str, Publication]:
        """Empty on a database not migrated yet, which a dry run doesn't migrate."""
        with self.connection.transaction():
            exists = self.connection.execute("SELECT to_regclass('publication')").fetchone()
            if exists is None or exists[0] is None:
                return {}
            rows = self.connection.execute(
                "SELECT youtube_id, title, published, duration, raw_key, digest_path,"
                " embedding_model, chunking FROM publication WHERE source = %s",
                (source,),
            ).fetchall()
        return {row[0]: Publication(source, *row) for row in rows}

    def put(self, publication: Publication, chunks: Sequence[EmbeddedChunk]) -> None:
        p = publication
        with self.connection.transaction(), self.connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM publication WHERE source = %s AND youtube_id = %s",
                (p.source, p.youtube_id),
            )
            cursor.execute(
                "INSERT INTO publication (source, youtube_id, title, published, duration,"
                " raw_key, digest_path, embedding_model, chunking)"
                " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    p.source,
                    p.youtube_id,
                    p.title,
                    p.published,
                    p.duration,
                    p.raw_key,
                    p.digest_path,
                    p.embedding_model,
                    p.chunking,
                ),
            )
            cursor.executemany(
                "INSERT INTO chunk (source, youtube_id, position, start_seconds, end_seconds,"
                " text, embedding) VALUES (%s, %s, %s, %s, %s, %s, %s::vector)",
                [
                    (
                        p.source,
                        p.youtube_id,
                        c.chunk.position,
                        c.chunk.start,
                        c.chunk.end,
                        c.chunk.text,
                        vector_literal(c.embedding),
                    )
                    for c in chunks
                ],
            )

    def set_digest_path(self, source: str, youtube_id: str, digest_path: str | None) -> None:
        with self.connection.transaction():
            self.connection.execute(
                "UPDATE publication SET digest_path = %s WHERE source = %s AND youtube_id = %s",
                (digest_path, source, youtube_id),
            )

    def nearest(
        self,
        embedding: Sequence[float],
        model: str,
        *,
        source: str | None = None,
        start: date | None = None,
        end: date | None = None,
        limit: int,
    ) -> list[Hit]:
        """The `limit` chunks nearest the embedding among those of the Source and the period.

        The filter runs first, in a materialized CTE, and the ranking is exact over what it keeps:
        ordered straight on `embedding <=> …`, the HNSW index would pick its nearest chunks
        before filtering, and a narrow period would come back with fewer than `limit` or none.
        Only chunks embedded by `model` compare with its query.
        """
        with self.connection.transaction():
            rows = self.connection.execute(
                SEARCH_SQL,
                {
                    "embedding": vector_literal(embedding),
                    "model": model,
                    "source": source,
                    "start": start,
                    "end": end,
                    "limit": limit,
                },
            ).fetchall()
        return [
            Hit(
                Publication(*row[:9]),
                Chunk(row[9], row[10], row[11], row[12]),
                float(row[13]),
            )
            for row in rows
        ]


SEARCH_SQL = """
WITH candidate AS MATERIALIZED (
    SELECT c.source, c.youtube_id, c.position
    FROM chunk c JOIN publication p USING (source, youtube_id)
    WHERE p.embedding_model = %(model)s
      AND (%(source)s::text IS NULL OR p.source = %(source)s::text)
      AND (%(start)s::date IS NULL OR p.published >= %(start)s::date)
      AND (%(end)s::date IS NULL OR p.published <= %(end)s::date)
)
SELECT p.source, p.youtube_id, p.title, p.published, p.duration, p.raw_key, p.digest_path,
       p.embedding_model, p.chunking, c.position, c.start_seconds, c.end_seconds, c.text,
       c.embedding <=> %(embedding)s::vector AS distance
FROM candidate
JOIN chunk c USING (source, youtube_id, position)
JOIN publication p USING (source, youtube_id)
ORDER BY distance
LIMIT %(limit)s
"""

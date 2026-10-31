-- The search index: one row per Publication whose Raw is in the bucket, and its Raw cut into
-- chunks of about two minutes, each with the seconds it starts and ends at and its embedding.
-- Applied once, in order, by `wikipol index` (wikipol/index/store.py).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE publication (
    source          text NOT NULL,
    youtube_id      text NOT NULL,
    title           text NOT NULL,
    published       date,
    -- NULL when unknown: about 140 Raws copied from Drive carry no date (decisions.md#DEC-20).
    duration        integer CHECK (duration >= 0),
    -- Seconds; known for a Raw the Fetcher stored, NULL for one copied from Drive.
    raw_key         text NOT NULL UNIQUE,
    -- The Raw's object key in the bucket: <source>/<youtube_id>.md
    digest_path     text,
    -- The repo path of its Digest in the Source's Chronicle, once it has one.
    embedding_model text NOT NULL,
    chunking        integer NOT NULL,
    -- What its chunks were cut and embedded with; another model or version indexes it again.
    indexed_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (source, youtube_id)
);

CREATE INDEX publication_published ON publication (published);

CREATE TABLE chunk (
    source        text NOT NULL,
    youtube_id    text NOT NULL,
    position      integer NOT NULL CHECK (position >= 0),
    start_seconds integer,
    end_seconds   integer,
    -- NULL both, for a Raw without timestamps.
    text          text NOT NULL,
    embedding     vector(1024) NOT NULL,
    PRIMARY KEY (source, youtube_id, position),
    FOREIGN KEY (source, youtube_id) REFERENCES publication ON DELETE CASCADE,
    CHECK ((start_seconds IS NULL) = (end_seconds IS NULL)),
    CHECK (end_seconds >= start_seconds)
);

CREATE INDEX chunk_embedding ON chunk USING hnsw (embedding vector_cosine_ops);

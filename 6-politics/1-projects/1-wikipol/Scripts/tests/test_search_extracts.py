"""`find_extracts` on an in-memory index and a fake embedder: what a question finds, in what
order, inside which Source and period, and what it refuses. No Scaleway, no database."""

from datetime import date

import pytest

from wikipol.index.chunks import Chunk
from wikipol.index.embed import Embeddings
from wikipol.index.store import EmbeddedChunk, InMemoryIndex, Publication
from wikipol.search.extracts import SearchRefused, find_extracts, period_bound, query_text

MODEL = "fake-embedding"
SOURCES = ("paduteam", "boniface")


class TopicEmbedder:
    """Embeds a text along the topics it names, so that nearness is predictable: a text naming
    a topic as often as the query, relative to the others, points the query's way."""

    model = MODEL
    topics = ("retraites", "gaza", "nupes")

    def __init__(self) -> None:
        self.texts: list[str] = []

    def embed(self, texts):
        self.texts.extend(texts)
        vectors = [[1.0 + 4.0 * text.count(t) for t in self.topics] for text in texts]
        return Embeddings(vectors, tokens=len(texts))


def publication(source, youtube_id, published, digest=None, model=MODEL):
    return Publication(
        source=source,
        youtube_id=youtube_id,
        title=f"Titre de {youtube_id}",
        published=published,
        duration=600,
        raw_key=f"{source}/{youtube_id}.md",
        digest_path=digest,
        embedding_model=model,
        chunking=1,
    )


def index_with(*entries):
    """Each entry: a Publication and its chunks' (start, text)."""
    index = InMemoryIndex()
    embedder = TopicEmbedder()
    for pub, chunks in entries:
        texts = [text for _, text in chunks]
        vectors = embedder.embed(texts).vectors if texts else []
        index.put(
            pub,
            [
                EmbeddedChunk(Chunk(n, start, None if start is None else start + 120, text), v)
                for n, ((start, text), v) in enumerate(zip(chunks, vectors, strict=True))
            ],
        )
    return index


@pytest.fixture
def index():
    return index_with(
        (
            publication("paduteam", "retraite025", date(2025, 3, 14), "6-politics/x/1-a.md"),
            [(0, "on parle de gaza"), (750, "la réforme des retraites, retraites encore")],
        ),
        (
            publication("paduteam", "retraite023", date(2023, 1, 19)),
            [(30, "retraites retraites retraites")],
        ),
        (
            publication("boniface", "gazagaza025", date(2025, 6, 2)),
            [(90, "gaza gaza")],
        ),
        (publication("paduteam", "sansdate001", None), [(None, "retraites sans date")]),
    )


def search(index, query, **options):
    embedder = TopicEmbedder()
    extracts = find_extracts(query, embedder, index, sources=SOURCES, **options)
    return extracts, embedder


def test_extracts_come_nearest_first_with_their_link_publication_and_digest(index):
    extracts, embedder = search(index, "retraites", limit=3)

    assert [e.url for e in extracts] == [
        "https://www.youtube.com/watch?v=sansdate001",
        "https://www.youtube.com/watch?v=retraite025&t=750s",
        "https://www.youtube.com/watch?v=retraite023&t=30s",
    ]
    first, second, third = extracts
    assert second.passage == "la réforme des retraites, retraites encore"
    assert second.at == "12:30"
    assert second.title == "Titre de retraite025"
    assert second.published == date(2025, 3, 14)
    assert second.digest == "6-politics/x/1-a.md"
    assert second.source == "paduteam"
    assert first.similarity > second.similarity > third.similarity
    assert first.at is None and first.published is None and first.digest is None
    assert embedder.texts == [query_text("retraites")]
    assert embedder.texts[0].startswith("Instruct: ") and "\nQuery:retraites" in embedder.texts[0]


def test_a_period_keeps_the_publications_dated_inside_it_only(index):
    extracts, _ = search(index, "retraites", start="2025", end="2025")

    assert {e.url.split("&")[0][-11:] for e in extracts} == {"retraite025", "gazagaza025"}


def test_the_filter_runs_before_the_ranking_so_a_narrow_period_still_fills_the_limit():
    near = [(n * 30, "retraites retraites") for n in range(10)]
    index = index_with(
        (publication("paduteam", "proche00001", date(2024, 1, 1)), near),
        (publication("paduteam", "lointain001", date(2025, 2, 1)), [(0, "gaza"), (30, "nupes")]),
    )

    extracts, _ = search(index, "retraites", start="2025-02", end="2025-02", limit=2)

    assert [e.passage for e in extracts] == ["gaza", "nupes"]


def test_a_source_keeps_its_own_publications_only(index):
    extracts, _ = search(index, "gaza", source="boniface")

    assert [e.source for e in extracts] == ["boniface"]


def test_chunks_embedded_by_another_model_are_not_compared(index):
    index.put(
        publication("paduteam", "ancien00001", date(2025, 1, 1), model="older-model"),
        [EmbeddedChunk(Chunk(0, 0, 120, "retraites"), [9.0, 1.0, 1.0])],
    )

    extracts, _ = search(index, "retraites", limit=25)

    assert "ancien00001" not in {e.url[-11:] for e in extracts}


@pytest.mark.parametrize(
    ("text", "last", "day"),
    [
        ("2025", False, date(2025, 1, 1)),
        ("2025", True, date(2025, 12, 31)),
        ("2024-02", True, date(2024, 2, 29)),
        ("2024-02", False, date(2024, 2, 1)),
        (" 2025-03-14 ", True, date(2025, 3, 14)),
    ],
)
def test_a_period_bound_is_a_year_a_month_or_a_day(text, last, day):
    assert period_bound(text, last=last) == day


@pytest.mark.parametrize(
    ("options", "message"),
    [
        ({"query": "  "}, "the query is empty"),
        ({"source": "inconnue"}, "no Source 'inconnue'; the Sources are paduteam, boniface"),
        ({"start": "mars 2025"}, "is not a date"),
        ({"end": "2025-02-30"}, "is not a date"),
        ({"start": "2025-06", "end": "2025-05"}, "ends (2025-05) before it starts (2025-06)"),
        ({"limit": 0}, "limit must be between 1 and 25"),
        ({"limit": 26}, "limit must be between 1 and 25"),
    ],
)
def test_a_question_that_cannot_be_searched_is_refused_before_any_embedding(
    index, options, message
):
    embedder = TopicEmbedder()
    query = options.pop("query", "retraites")

    with pytest.raises(SearchRefused, match=message.replace("(", r"\(").replace(")", r"\)")):
        find_extracts(query, embedder, index, sources=SOURCES, **options)
    assert embedder.texts == []

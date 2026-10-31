"""`wikipol index` on an in-memory bucket, a fake embedder and an in-memory index: what gets
indexed, what is skipped, what a re-run does. No Scaleway, no database."""

from dataclasses import replace
from datetime import date

import pytest
from conftest import write

from wikipol import cli
from wikipol.config import ConfigError, load_index_settings, load_source
from wikipol.index.chunks import CHUNKING
from wikipol.index.embed import EmbeddingFailed, Embeddings
from wikipol.index.run import format_report, index_source
from wikipol.index.store import InMemoryIndex
from wikipol.raw_store import InMemoryRawStore, RawMeta

CHRONICLE = "6-politics/2-sources/1-demo/1-chronicle"
FETCHED = "fetched0001"  # a date and a duration in its metadata
FROM_NOTE = "notenote001"  # no date in the bucket, one in the frozen vault's Videos note
UNDATED = "nodatenod01"
SILENT = "silentsil01"  # a Raw without a word


class FakeEmbedder:
    model = "fake-embedding"

    def __init__(self, fail_on: str | None = None):
        self.fail_on = fail_on
        self.texts: list[str] = []

    def embed(self, texts):
        if self.fail_on and any(self.fail_on in text for text in texts):
            raise EmbeddingFailed("Generative APIs answered 503")
        self.texts.extend(texts)
        return Embeddings([[float(len(t)), 0.0] for t in texts], tokens=2 * len(texts))


def raw(youtube_id: str, blocks: int = 6) -> bytes:
    body = "\n\n\n".join(
        f"{n // 2}:{n % 2 * 3}0\n\nvidéo {youtube_id}, bloc {n}." for n in range(blocks)
    )
    return f"---\nyoutube_id: {youtube_id}\n---\n\n{body}\n".encode()


@pytest.fixture
def repo(tmp_path):
    node = tmp_path / "6-politics" / "2-sources" / "1-demo"
    write(
        node / "source.yaml",
        """
        source:
          name: Demo
          slug: demo
        legacy:
          vault: "../../Legacy/Demo"
        """,
    )
    write(
        node / "1-chronicle" / "1-2026-01-01" / f"2026-01-02 Un titre {FETCHED}.md",
        f"---\nyoutube_id: {FETCHED}\ndigest_version: 1\nmodel: claude-sonnet-5-5\n---\n# Un\n",
    )
    write(
        tmp_path / "6-politics" / "Legacy" / "Demo" / "Videos" / "Une fiche.md",
        f"---\ndate: 2025-12-31\nyoutube_id: {FROM_NOTE}\n---\n# Une fiche\n",
    )
    return tmp_path


@pytest.fixture
def source(repo):
    return load_source(repo / "6-politics" / "2-sources" / "1-demo")


@pytest.fixture
def raws():
    store = InMemoryRawStore()
    store.put("demo", FETCHED, raw(FETCHED), RawMeta("Fetched", date(2026, 1, 2), 180))
    store.put("demo", FROM_NOTE, raw(FROM_NOTE), RawMeta("From note"))
    store.put("demo", UNDATED, raw(UNDATED, blocks=2), RawMeta("Undated"))
    store.put("demo", SILENT, b"---\nyoutube_id: silentsil01\n---\n\n0:00\n\n", RawMeta("Silent"))
    store.put("other", "otherothe01", raw("otherothe01"), RawMeta("Another Source's"))
    return store


def run(source, raws, index, embedder=None, **kwargs):
    return index_source(
        source,
        raws,
        embedder or FakeEmbedder(),
        index,
        repo_root=source.node.parents[2],
        **kwargs,
    )


def test_every_raw_of_the_source_becomes_a_publication_with_its_chunks(source, raws):
    index = InMemoryIndex()
    report = run(source, raws, index)
    assert sorted(report.indexed) == sorted([FETCHED, FROM_NOTE, UNDATED])
    assert report.empty == [SILENT]
    assert report.undated == [UNDATED]
    fetched = index.publications[("demo", FETCHED)]
    assert (fetched.title, fetched.published, fetched.duration) == (
        "Fetched",
        date(2026, 1, 2),
        180,
    )
    assert fetched.raw_key == f"demo/{FETCHED}.md"
    assert fetched.digest_path == f"{CHRONICLE}/1-2026-01-01/2026-01-02 Un titre {FETCHED}.md"
    assert (fetched.embedding_model, fetched.chunking) == ("fake-embedding", CHUNKING)
    assert index.publications[("demo", FROM_NOTE)].published == date(2025, 12, 31)
    assert index.publications[("demo", FROM_NOTE)].digest_path is None
    assert index.publications[("demo", UNDATED)].published is None
    # Six 30-second blocks, 180 s: two chunks sharing the block at 1:30.
    chunks = index.chunks[("demo", FETCHED)]
    assert [(c.chunk.start, c.chunk.end) for c in chunks] == [(0, 120), (90, 180)]
    assert chunks[0].embedding == [float(len(chunks[0].chunk.text)), 0.0]
    assert report.tokens == 2 * report.chunks
    assert ("other", "otherothe01") not in index.publications


def test_a_rerun_indexes_only_what_is_new_and_follows_a_moved_digest(source, raws, repo):
    index = InMemoryIndex()
    run(source, raws, index)
    raws.put("demo", "newnewnew01", raw("newnewnew01"), RawMeta("New", date(2026, 2, 1), 180))
    old = repo / CHRONICLE / "1-2026-01-01" / f"2026-01-02 Un titre {FETCHED}.md"
    moved = repo / CHRONICLE / "2-2026-01-02" / old.name
    moved.parent.mkdir()
    old.rename(moved)
    embedder = FakeEmbedder()
    report = run(source, raws, index, embedder)
    assert report.indexed == ["newnewnew01"]
    assert all("newnewnew01" in text for text in embedder.texts)
    assert report.up_to_date == 4  # the silent one too, a Publication without chunks
    assert report.relinked == 1
    assert index.publications[("demo", FETCHED)].digest_path == (
        f"{CHRONICLE}/2-2026-01-02/{old.name}"
    )
    assert run(source, raws, index, FakeEmbedder()).indexed == []


def test_a_publication_indexed_with_another_model_or_chunking_is_indexed_again(source, raws):
    index = InMemoryIndex()
    run(source, raws, index)
    key = ("demo", FETCHED)
    index.publications[key] = replace(index.publications[key], chunking=CHUNKING - 1)
    assert run(source, raws, index).indexed == [FETCHED]
    index.publications[key] = replace(index.publications[key], embedding_model="older-model")
    assert run(source, raws, index).indexed == [FETCHED]


def test_limit_caps_the_raws_read_and_leaves_the_rest(source, raws):
    index = InMemoryIndex()
    report = run(source, raws, index, limit=2)
    assert len(report.indexed) + len(report.empty) == 2
    assert report.indexed == [FETCHED, UNDATED]  # by id
    assert report.left == 2
    assert run(source, raws, index).indexed == [FROM_NOTE]  # the silent one has no words


def test_a_raw_without_words_is_a_publication_without_chunks_outside_the_limit(source, raws):
    index = InMemoryIndex()
    raws.put("demo", "zzzzzzzzzz1", raw("zzzzzzzzzz1"), RawMeta("After the silent one"))
    report = run(source, raws, index, limit=3)  # the silent one, fourth by id, isn't counted
    assert report.indexed == [FETCHED, UNDATED, FROM_NOTE]
    assert report.empty == []
    report = run(source, raws, index, limit=1)
    assert (report.empty, report.indexed) == ([SILENT], ["zzzzzzzzzz1"])
    assert index.publications[("demo", SILENT)].title == "Silent"
    assert index.chunks[("demo", SILENT)] == []
    report = run(source, raws, index)
    assert (report.empty, report.indexed, report.up_to_date) == ([], [], 5)


def test_a_failed_embedding_stops_the_run_and_keeps_what_was_indexed(source, raws):
    index = InMemoryIndex()
    report = run(source, raws, index, FakeEmbedder(fail_on=FROM_NOTE))
    assert report.stopped.startswith(f"{FROM_NOTE}: ")
    assert ("demo", FROM_NOTE) not in index.publications
    assert report.indexed == [FETCHED, UNDATED]  # ids are taken in order
    assert report.left == 2
    assert run(source, raws, index).indexed == [FROM_NOTE]


def test_a_dry_run_embeds_and_writes_nothing_but_counts_the_words(source, raws):
    index, embedder = InMemoryIndex(), FakeEmbedder()
    report = run(source, raws, index, embedder, dry_run=True)
    assert sorted(report.indexed) == sorted([FETCHED, FROM_NOTE, UNDATED])
    assert report.words > 0 and report.tokens == 0
    assert embedder.texts == [] and index.publications == {}
    text = format_report([report], dry_run=True)
    assert "3 to index" in text and "about" in text and "EUR" in text


def test_the_report_names_what_has_no_date_and_what_has_no_words(source, raws):
    text = format_report([run(source, raws, InMemoryIndex())])
    assert f"without a date: {UNDATED}" in text
    assert f"without words: {SILENT}" in text
    assert "tokens embedded" in text


def test_index_settings_take_the_embedding_key_before_the_pipeline_key(tmp_path):
    no_file = {"WIKIPOL_ENV": str(tmp_path / "no-such.env")}
    env = {**no_file, "WIKIPOL_DATABASE_URL": "postgresql://u:p@h/db", "SCW_SECRET_KEY": "pipeline"}
    assert load_index_settings(env).embedding_key == "pipeline"
    env["WIKIPOL_EMBEDDING_API_KEY"] = "genai"
    settings = load_index_settings(env)
    assert settings.embedding_key == "genai"
    assert "genai" not in repr(settings) and "postgresql" not in repr(settings)
    with pytest.raises(ConfigError, match="WIKIPOL_DATABASE_URL"):
        load_index_settings({**no_file, "SCW_SECRET_KEY": "pipeline"})
    with pytest.raises(ConfigError, match="WIKIPOL_EMBEDDING_API_KEY"):
        load_index_settings({**no_file, "WIKIPOL_DATABASE_URL": "postgresql://h/db"})
    assert load_index_settings({**no_file, "WIKIPOL_DATABASE_URL": "x"}, need_embedding=False)


def test_the_command_refuses_an_unknown_source_before_reaching_anything(repo, capsys):
    sources = repo / "6-politics" / "2-sources"
    assert cli.main(["index", "--source", "nope", "--sources-dir", str(sources)]) == 2
    assert "no Source with slug nope" in capsys.readouterr().err


def test_the_command_stops_at_the_first_source_whose_embedding_fails(
    repo, raws, monkeypatch, capsys
):
    sources = repo / "6-politics" / "2-sources"
    write(sources / "2-other" / "source.yaml", "source:\n  name: Other\n  slug: other\n")
    index = InMemoryIndex()
    index.migrate = lambda: []
    index.close = lambda: None
    monkeypatch.setattr(cli.PostgresIndex, "connect", classmethod(lambda cls, url: index))
    monkeypatch.setattr(cli.S3RawStore, "from_settings", classmethod(lambda cls, s: raws))
    monkeypatch.setattr(cli, "ScalewayEmbedder", lambda key, project: FakeEmbedder(fail_on="vidéo"))
    for name, value in {
        "WIKIPOL_DATABASE_URL": "postgresql://h/db",
        "SCW_SECRET_KEY": "k",
        "SCW_ACCESS_KEY": "a",
        "WIKIPOL_S3_BUCKET": "b",
        "WIKIPOL_S3_ENDPOINT": "https://s3.example",
    }.items():
        monkeypatch.setenv(name, value)
    assert cli.main(["index", "--sources-dir", str(sources)]) == 1
    out = capsys.readouterr().out
    assert "stopped: fetched0001: Generative APIs answered 503" in out
    assert "other:" not in out  # the next Source wasn't tried
    assert index.publications == {}

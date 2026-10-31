"""`wikipol backfill` on a fake writer and an in-memory bucket: no claude, no Scaleway."""

import re
from datetime import date, timedelta

import pytest
from conftest import write

from wikipol import cli
from wikipol.backfill import backfill, format_report
from wikipol.config import load_source
from wikipol.digest.format import split_digest
from wikipol.raw_store import InMemoryRawStore, RawMeta

MODEL = "claude-sonnet-5-5"
TODAY = date(2026, 10, 31)
CHRONICLE = "6-politics/2-sources/1-demo/1-chronicle"
DAY = date(2026, 1, 1)
# Eight dated Raws whose ids don't follow their dates: the run must go by date.
DATED = {f"vid{n:08d}": DAY + timedelta(days=(n * 5) % 8) for n in range(1, 9)}
OLDEST_FIRST = sorted(DATED, key=lambda youtube_id: (DATED[youtube_id], youtube_id))
FROM_NOTE = "notenote001"  # no date in the bucket, one in the frozen vault's Videos note
UNDATED = "nodatenod01"
SILENT = "musiquemus1"  # captions with no speech


def raw(youtube_id: str, speech: str | None = None) -> bytes:
    speech = speech or f"La gauche doit aller chercher les campagnes, vidéo {youtube_id}."
    return f"---\nyoutube_id: {youtube_id}\n---\n\n0:00\n\n{speech}\n".encode()


@pytest.fixture
def repo(tmp_path):
    node = tmp_path / "6-politics" / "2-sources" / "1-demo"
    write(
        node / "source.yaml",
        f"""
        source:
          name: Demo
          slug: demo
          attribution: "la Démo"
        legacy:
          vault: "../../Legacy/Demo"
        claude:
          default_model: {MODEL}
        """,
    )
    write(node / "CLAUDE.md", "# Demo\n\nRestituer, pas neutraliser.\n")
    write(node / "1-chronicle" / "CLAUDE.md", "---\ntitle: Chronicle\n---\n# Chronicle\n\nVide.\n")
    write(
        tmp_path / "6-politics" / "Legacy" / "Demo" / "Videos" / "Une fiche.md",
        f"---\ndate: 2025-12-31\nyoutube_id: {FROM_NOTE}\n---\n# Une fiche\n",
    )
    return tmp_path


@pytest.fixture
def source(repo):
    return load_source(repo / "6-politics" / "2-sources" / "1-demo")


@pytest.fixture
def store():
    store = InMemoryRawStore()
    for youtube_id, published in DATED.items():
        store.put("demo", youtube_id, raw(youtube_id), RawMeta(f"VIDÉO {youtube_id}", published))
    store.put("demo", FROM_NOTE, raw(FROM_NOTE), RawMeta("LA FICHE LEGACY"))
    store.put("demo", UNDATED, raw(UNDATED), RawMeta("SANS DATE"))
    store.put("demo", SILENT, raw(SILENT, "[Musique] [Applaudissements]"), RawMeta("MUSIQUE", DAY))
    return store


class FakeWriter:
    """Writes a Digest that passes the check, or a Period summary, as the prompt asks."""

    def __init__(
        self, digest_ok: bool = True, summary_ok: bool = True, refused: frozenset = frozenset()
    ) -> None:
        self.digest_ok, self.summary_ok, self.refused = digest_ok, summary_ok, refused
        self.digests: list[str] = []
        self.periods = 0
        self.models: set[str] = set()

    def __call__(self, skill: str, prompt: str, model: str) -> str:
        self.models.add(model)
        if "# Le Raw" in prompt:
            youtube_id = re.search(r"^- youtube_id : (\S+)$", prompt, re.M).group(1)
            self.digests.append(youtube_id)
            ok = self.digest_ok and youtube_id not in self.refused
            quote = "la gauche doit aller chercher" if ok else "rien de tout cela ici"
            url = f"https://www.youtube.com/watch?v={youtube_id}&t=0s"
            return (
                "---\npreview: >-\n  La Démo soutient que la gauche doit aller aux campagnes.\n"
                f"---\n## 1. Aller aux campagnes.\n\n> [0:00]({url}) « {quote} »\n"
            )
        self.periods += 1
        body = "Un paragraphe." if self.summary_ok else "# Un titre interdit"
        return f"---\npreview: >-\n  La Démo parle des campagnes.\n---\n{body}\n"


def run(source, store, writer, repo, tmp_path, **kwargs):
    return backfill(
        source, store, writer, staging=tmp_path / "staging", today=TODAY, repo_root=repo, **kwargs
    )


def digests_in(repo) -> dict[str, dict]:
    """The Chronicle's Digests: youtube_id -> frontmatter."""
    found = {}
    for path in (repo / CHRONICLE).rglob("*.md"):
        frontmatter, _ = split_digest(path.read_text())
        if frontmatter and "digest_version" in frontmatter:
            found[frontmatter["youtube_id"]] = frontmatter
    return found


def staged(tmp_path) -> list[str]:
    folder = tmp_path / "staging"
    return sorted(p.stem for p in folder.glob("*.md")) if folder.is_dir() else []


def test_the_raws_are_digested_oldest_first_and_filed(source, store, repo, tmp_path):
    writer = FakeWriter()

    report = run(source, store, writer, repo, tmp_path)

    assert writer.digests == [FROM_NOTE, *OLDEST_FIRST]
    assert writer.models == {MODEL}
    assert set(digests_in(repo)) == {FROM_NOTE, *DATED}
    assert digests_in(repo)[FROM_NOTE]["published"] == date(2025, 12, 31)
    assert report.no_date == [UNDATED]
    assert report.no_captions == [SILENT]
    assert len(report.filed) == 9
    assert all((repo / path).is_file() for path in report.filed)  # where the run left them
    assert report.left == 0
    assert report.failed == [] and report.stopped is None
    assert staged(tmp_path) == []  # filed Digests leave the staging folder


def test_digests_are_filed_by_batch_and_later_ones_may_cite_earlier_ones(
    source, store, repo, tmp_path
):
    prompts: list[str] = []
    writer = FakeWriter()

    def spy(skill, prompt, model):
        prompts.append(prompt)
        return writer(skill, prompt, model)

    report = run(source, store, spy, repo, tmp_path, batch=6)

    digest_prompts = [p for p in prompts if "# Le Raw" in p]
    assert "n'écris aucun wikilink" in digest_prompts[5]  # the first batch sees no Digest
    assert f"[[{CHRONICLE}/" in digest_prompts[6]  # the second sees the first, filed
    assert report.summarized >= 2


def test_limit_caps_the_raws_handed_to_the_model(source, store, repo, tmp_path):
    writer = FakeWriter()

    report = run(source, store, writer, repo, tmp_path, limit=3)

    assert writer.digests == [FROM_NOTE, *OLDEST_FIRST[:2]]
    assert len(report.filed) == 3
    assert report.left == 6


def test_a_second_run_over_a_finished_backfill_writes_nothing(source, store, repo, tmp_path):
    run(source, store, FakeWriter(), repo, tmp_path)
    before = {p: p.read_text() for p in (repo / CHRONICLE).rglob("*.md")}
    writer = FakeWriter()

    report = run(source, store, writer, repo, tmp_path)

    assert writer.digests == [] and writer.periods == 0
    assert report.up_to_date == 9 and report.to_digest == []
    assert {p: p.read_text() for p in (repo / CHRONICLE).rglob("*.md")} == before


def test_a_run_stopped_by_a_refused_summary_resumes_without_writing_twice(
    source, store, repo, tmp_path
):
    chronicle = (repo / CHRONICLE / "CLAUDE.md").read_text()

    stopped = run(source, store, FakeWriter(summary_ok=False), repo, tmp_path, limit=4)

    assert stopped.stopped and "the Chronicle is unchanged" in stopped.stopped
    assert stopped.filed == []
    assert digests_in(repo) == {}
    assert (repo / CHRONICLE / "CLAUDE.md").read_text() == chronicle
    assert staged(tmp_path) == sorted([FROM_NOTE, *OLDEST_FIRST[:3]])

    writer = FakeWriter()
    resumed = run(source, store, writer, repo, tmp_path, limit=1)

    assert resumed.resumed == [FROM_NOTE, *OLDEST_FIRST[:3]]
    assert writer.digests == [OLDEST_FIRST[3]]  # the limit counts only what the model writes
    assert set(digests_in(repo)) == {FROM_NOTE, *OLDEST_FIRST[:4]}
    assert staged(tmp_path) == []


def test_a_staged_digest_that_no_longer_checks_is_written_again(source, store, repo, tmp_path):
    write(tmp_path / "staging" / f"{FROM_NOTE}.md", "---\ntitle: abîmé\n---\nRien.\n")
    writer = FakeWriter()

    report = run(source, store, writer, repo, tmp_path, limit=1)

    assert report.resumed == []
    assert writer.digests == [FROM_NOTE]
    assert set(digests_in(repo)) == {FROM_NOTE}


def test_a_digest_by_another_model_is_written_again_in_its_place(source, store, repo, tmp_path):
    run(source, store, FakeWriter(), repo, tmp_path)
    paths = sorted(p.relative_to(repo) for p in (repo / CHRONICLE).rglob("*.md"))
    yaml_path = repo / "6-politics" / "2-sources" / "1-demo" / "source.yaml"
    yaml_path.write_text(yaml_path.read_text().replace(MODEL, "claude-sonnet-6-0"))
    writer = FakeWriter()

    report = run(load_source(yaml_path.parent), store, writer, repo, tmp_path)

    assert writer.digests == [FROM_NOTE, *OLDEST_FIRST]
    assert {fm["model"] for fm in digests_in(repo).values()} == {"claude-sonnet-6-0"}
    assert sorted(p.relative_to(repo) for p in (repo / CHRONICLE).rglob("*.md")) == paths
    assert report.up_to_date == 0


def test_refused_digests_are_failures_and_three_in_a_row_stop_the_run(
    source, store, repo, tmp_path
):
    writer = FakeWriter(digest_ok=False)

    report = run(source, store, writer, repo, tmp_path)

    assert [youtube_id for youtube_id, _ in report.failed] == [FROM_NOTE, *OLDEST_FIRST[:2]]
    assert report.stopped == "3 failures in a row"
    assert len(writer.digests) == 6  # each Raw: a draft, and one retry
    assert sorted(p.stem for p in report.rejected_drafts.glob("*.md")) == sorted(
        [FROM_NOTE, *OLDEST_FIRST[:2]]
    )
    assert digests_in(repo) == {}


def test_a_dry_run_lists_what_it_would_digest_and_writes_nothing(source, store, repo, tmp_path):
    writer = FakeWriter()

    report = run(source, store, writer, repo, tmp_path, dry_run=True)

    assert writer.digests == [] and writer.periods == 0
    assert report.to_digest == [FROM_NOTE, *OLDEST_FIRST]
    assert not (tmp_path / "staging").exists()
    text = format_report(report, limit=2, dry_run=True)
    assert text.splitlines()[1:3] == [
        f"  would digest: {FROM_NOTE}",
        f"  would digest: {OLDEST_FIRST[0]}",
    ]
    assert f"  no date, can't be filed: {UNDATED}" in text
    assert f"  no usable captions: {SILENT}" in text


def test_the_command_backfills_with_the_bucket_and_claude(
    source, store, repo, tmp_path, monkeypatch, capsys
):
    writer = FakeWriter()
    monkeypatch.setattr(cli.S3RawStore, "from_settings", classmethod(lambda cls, s: store))
    monkeypatch.setattr(cli, "ClaudeCli", lambda: writer)
    for name, value in {
        "WIKIPOL_S3_BUCKET": "raws",
        "WIKIPOL_S3_ENDPOINT": "https://s3.example.test",
        "SCW_ACCESS_KEY": "fake",
        "SCW_SECRET_KEY": "fake",
    }.items():
        monkeypatch.setenv(name, value)
    sources = repo / "6-politics" / "2-sources"
    arguments = ["backfill", "--source", "demo", "--sources-dir", str(sources), "--limit", "2"]

    code = cli.main([*arguments, "--staging", str(tmp_path / "staging")])

    assert code == 0
    assert writer.digests == [FROM_NOTE, OLDEST_FIRST[0]]
    out = capsys.readouterr().out
    assert out.startswith("demo: 11 Raws, 0 with an up-to-date Digest, 1 without a date")
    assert "written 2, taken back from staging 0, filed 2" in out
    assert "7 left for a later run" in out


def test_what_was_written_before_three_failures_is_still_filed(source, store, repo, tmp_path):
    writer = FakeWriter(refused=frozenset(OLDEST_FIRST[1:4]))

    report = run(source, store, writer, repo, tmp_path)

    assert report.stopped == "3 failures in a row"
    assert set(digests_in(repo)) == {FROM_NOTE, OLDEST_FIRST[0]}
    assert staged(tmp_path) == []


def test_a_digest_the_chronicle_refuses_doesn_t_hold_back_its_batch(source, store, repo, tmp_path):
    run(source, store, FakeWriter(), repo, tmp_path)
    # Rewritten by a new model with another date, it can't take its old place (DEC-14).
    yaml_path = repo / "6-politics" / "2-sources" / "1-demo" / "source.yaml"
    yaml_path.write_text(yaml_path.read_text().replace(MODEL, "claude-sonnet-6-0"))
    note = repo / "6-politics" / "Legacy" / "Demo" / "Videos" / "Une fiche.md"
    note.write_text(note.read_text().replace("2025-12-31", "2026-06-01"))

    report = run(load_source(yaml_path.parent), store, FakeWriter(), repo, tmp_path)

    assert [youtube_id for youtube_id, _ in report.failed] == [FROM_NOTE]
    assert "can't be filed" in report.failed[0][1]
    assert (report.rejected_drafts / f"{FROM_NOTE}.md").is_file()
    models = {youtube_id: fm["model"] for youtube_id, fm in digests_in(repo).items()}
    assert models.pop(FROM_NOTE) == MODEL  # left as it was
    assert set(models.values()) == {"claude-sonnet-6-0"}
    assert staged(tmp_path) == []


def test_a_staged_digest_no_raw_needs_any_more_is_cleared(source, store, repo, tmp_path):
    run(source, store, FakeWriter(), repo, tmp_path)
    write(tmp_path / "staging" / f"{FROM_NOTE}.md", "un Digest déjà rangé\n")

    run(source, store, FakeWriter(), repo, tmp_path)

    assert staged(tmp_path) == []


def test_a_staged_digest_with_another_parent_is_written_again(source, store, repo, tmp_path):
    run(source, store, FakeWriter(summary_ok=False), repo, tmp_path, limit=1)
    path = tmp_path / "staging" / f"{FROM_NOTE}.md"
    path.write_text(path.read_text().replace(f"parent: {CHRONICLE}", "parent: ailleurs"))
    writer = FakeWriter()

    report = run(source, store, writer, repo, tmp_path, limit=1)

    assert report.resumed == []
    assert writer.digests == [FROM_NOTE]

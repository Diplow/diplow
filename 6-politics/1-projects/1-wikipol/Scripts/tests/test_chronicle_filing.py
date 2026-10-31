"""Filing Digests in a Chronicle on disk, and `wikipol file`, on a fake writer: no claude."""

import shutil
from datetime import date, timedelta
from pathlib import Path

import pytest
from conftest import write

from wikipol import cli
from wikipol.chronicle.filing import FilingError, plan_filing, rewrite_links
from wikipol.chronicle.period import PeriodRejected, write_period
from wikipol.chronicle.tree import Summary
from wikipol.config import load_source
from wikipol.digest.format import DigestFields, render, split_digest

MODEL = "claude-sonnet-5-5"
CHRONICLE = "6-politics/2-sources/1-demo/1-chronicle"
HAND_WRITTEN = """---
title: Chronicle
parent: 6-politics/2-sources/1-demo/1-chronicle
owner: diplo
preview: >-
  Les Digests de Demo rangés par date.
---
# Chronicle

Vide pour l'instant.
"""


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
        claude:
          default_model: {MODEL}
        """,
    )
    write(node / "CLAUDE.md", "# Demo\n\nRestituer, pas neutraliser.\n")
    write(node / "1-chronicle" / "CLAUDE.md", HAND_WRITTEN)
    return tmp_path


@pytest.fixture
def source(repo):
    return load_source(repo / "6-politics" / "2-sources" / "1-demo")


def youtube_id(number: int) -> str:
    return f"vid{number:08d}"


def digest(number: int, day: date, claims: str | None = None, source: str = "demo") -> str:
    fields = DigestFields(
        title=f"VIDÉO {number} !",
        parent=CHRONICLE,
        source=source,
        youtube_id=youtube_id(number),
        published=day,
        duration=None,
        ingested=date(2026, 10, 31),
        model=MODEL,
    )
    url = fields.url
    claims = claims or f"## 1. Une affirmation.\n\n> [0:00]({url}&t=0s) « cinq mots du Raw ici »"
    return render(fields, f"La Démo soutient la thèse {number}.", claims)


def summaries(calls: list[str] | None = None):
    def summarize(period, whole):
        if calls is not None:
            calls.append(period.title)
        return Summary(f"Résumé de {period.title}.", f"La Démo, {period.title}.")

    return summarize


def file_digests(source, repo, texts, calls=None):
    filing = plan_filing(source, texts, repo_root=repo)
    filing.summarize(summaries(calls))
    return filing, filing.apply()


def files_of(folder: Path) -> list[str]:
    return sorted(p.relative_to(folder).as_posix() for p in folder.rglob("*") if p.is_file())


DAYS = [date(2026, 1, 1) + timedelta(days=n) for n in range(8)]


def test_the_first_digest_goes_in_the_chronicle_which_write_period_then_summarizes(source, repo):
    calls: list[str] = []

    filing, _ = file_digests(source, repo, [digest(1, DAYS[0])], calls)

    chronicle = repo / CHRONICLE
    assert files_of(chronicle) == ["1-video-1.md", "CLAUDE.md"]
    frontmatter, _ = split_digest((chronicle / "1-video-1.md").read_text())
    assert frontmatter["parent"] == CHRONICLE
    assert calls == ["Chronicle"]
    text = (chronicle / "CLAUDE.md").read_text()
    assert text.startswith('---\ntitle: "Chronicle"\nparent: ' + CHRONICLE)
    assert "Résumé de Chronicle." in text
    assert "Vide pour l'instant." not in text
    assert text.endswith(f"## Contenu\n\n1. [[{CHRONICLE}/1-video-1|VIDÉO 1 !]] (2026-01-01)\n")
    assert [f"{leaf.path}.md" for leaf in filing.filed] == [f"{CHRONICLE}/1-video-1.md"]


def test_the_seventh_digest_splits_the_chronicle_and_every_link_follows(source, repo):
    first_link = f"[[{CHRONICLE}/1-video-1|la première]]"
    claims = (
        f"## 1. Une suite de {first_link}.\n\n"
        f"> [0:00](https://www.youtube.com/watch?v={youtube_id(2)}&t=0s) « cinq mots du Raw ici »"
    )
    texts = [digest(1, DAYS[0]), digest(2, DAYS[1], claims)]
    texts += [digest(n, DAYS[n - 1]) for n in range(3, 7)]
    file_digests(source, repo, texts)
    outside = write(repo / "6-politics" / "notes.md", f"Voir {first_link} et [[ailleurs]].\n")
    legacy = write(repo / "6-politics" / "Legacy" / "Demo" / "note.md", f"{first_link}\n")
    calls: list[str] = []

    filing, relinked = file_digests(source, repo, [digest(7, DAYS[6])], calls)

    chronicle = repo / CHRONICLE
    assert files_of(chronicle) == [
        "1-2026-01-01/1-video-1.md",
        "1-2026-01-01/2-video-2.md",
        "1-2026-01-01/3-video-3.md",
        "1-2026-01-01/4-video-4.md",
        "1-2026-01-01/CLAUDE.md",
        "2-2026-01-05/1-video-5.md",
        "2-2026-01-05/2-video-6.md",
        "2-2026-01-05/3-video-7.md",
        "2-2026-01-05/CLAUDE.md",
        "CLAUDE.md",
    ]
    new_first = f"[[{CHRONICLE}/1-2026-01-01/1-video-1|la première]]"
    assert new_first in (chronicle / "1-2026-01-01" / "2-video-2.md").read_text()
    assert outside.read_text() == f"Voir {new_first} et [[ailleurs]].\n"
    assert relinked == [outside]
    assert legacy.read_text() == f"{first_link}\n"  # the frozen vaults are never read
    frontmatter, _ = split_digest((chronicle / "2-2026-01-05" / "1-video-5.md").read_text())
    assert frontmatter["parent"] == f"{CHRONICLE}/2-2026-01-05"
    period = (chronicle / "2-2026-01-05" / "CLAUDE.md").read_text()
    assert period.startswith(
        f'---\ntitle: "2026-01-05 → 2026-01-07"\nparent: {CHRONICLE}/2-2026-01-05\nowner: diplo\n'
    )
    assert "# 2026-01-05 → 2026-01-07\n\nLa Démo, 2026-01-05 → 2026-01-07.\n" in period
    root = (chronicle / "CLAUDE.md").read_text()
    assert f"2. [[{CHRONICLE}/2-2026-01-05/CLAUDE|2026-01-05 → 2026-01-07]] (3 Digests)" in root
    assert calls == ["2026-01-01 → 2026-01-04", "2026-01-05 → 2026-01-07", "Chronicle"]
    assert len(filing.moved) == 6


def test_a_period_the_filing_did_not_touch_keeps_its_file_and_its_summary(source, repo):
    file_digests(source, repo, [digest(n, DAYS[n - 1]) for n in range(1, 8)])
    first = repo / CHRONICLE / "1-2026-01-01" / "CLAUDE.md"
    before = first.read_text()
    calls: list[str] = []

    file_digests(source, repo, [digest(8, DAYS[7])], calls)

    assert first.read_text() == before
    assert calls == ["2026-01-05 → 2026-01-08", "Chronicle"]


def test_a_period_left_as_it_was_still_follows_a_link_to_what_moved(source, repo):
    file_digests(source, repo, [digest(n, DAYS[n - 1]) for n in range(1, 8)])
    first = repo / CHRONICLE / "1-2026-01-01" / "CLAUDE.md"
    link = "|la sixième]]"
    old_link = f"[[{CHRONICLE}/2-2026-01-05/2-video-6{link}"
    first.write_text(first.read_text().replace("## Contenu", f"Voir {old_link}.\n\n## Contenu"))
    calls: list[str] = []

    # Filed between the fifth and the sixth: the sixth becomes 3-video-6, the first Period stays.
    file_digests(source, repo, [digest(0, DAYS[5])], calls)

    assert f"Voir [[{CHRONICLE}/2-2026-01-05/3-video-6{link}." in first.read_text()
    assert "2026-01-01 → 2026-01-04" not in calls


def test_a_digest_named_in_capitals_by_hand_is_renamed_not_lost(source, repo):
    write(repo / CHRONICLE / "1-VIDEO-1.md", digest(1, DAYS[0]))

    file_digests(source, repo, [digest(2, DAYS[1])])

    chronicle = repo / CHRONICLE
    assert files_of(chronicle) == ["1-video-1.md", "2-video-2.md", "CLAUDE.md"]
    assert "VIDÉO 1 !" in (chronicle / "1-video-1.md").read_text()


def test_a_summary_that_fails_leaves_the_chronicle_as_it_was(source, repo):
    file_digests(source, repo, [digest(n, DAYS[n - 1]) for n in range(1, 7)])
    chronicle = repo / CHRONICLE
    before = {path: (chronicle / path).read_text() for path in files_of(chronicle)}
    filing = plan_filing(source, [digest(7, DAYS[6])], repo_root=repo)

    def heading_drafts(skill, prompt, model):
        return "---\npreview: Un résumé.\n---\n## Un titre\n\nUn paragraphe.\n"

    with pytest.raises(PeriodRejected):
        filing.summarize(lambda period, whole: write_period(source, period, heading_drafts))

    assert {path: (chronicle / path).read_text() for path in files_of(chronicle)} == before


def test_a_period_left_without_a_summary_is_never_written(source, repo):
    filing = plan_filing(source, [digest(1, DAYS[0])], repo_root=repo)
    filing.root.summary = None

    with pytest.raises(ValueError, match="no summary"):
        filing.apply()

    assert (repo / CHRONICLE / "CLAUDE.md").read_text() == HAND_WRITTEN


def test_a_digest_without_a_date_has_no_place(source, repo):
    text = digest(1, DAYS[0]).replace("published: 2026-01-01", "published: null")

    with pytest.raises(FilingError, match="no published date"):
        plan_filing(source, [text], repo_root=repo)


def test_a_digest_of_another_source_is_refused(source, repo):
    with pytest.raises(FilingError, match="another Source"):
        plan_filing(source, [digest(1, DAYS[0], source="autre")], repo_root=repo)


def test_a_digest_given_twice_is_refused(source, repo):
    with pytest.raises(FilingError, match="given twice"):
        plan_filing(source, [digest(1, DAYS[0]), digest(1, DAYS[0])], repo_root=repo)


def test_a_digest_filed_again_on_another_day_is_refused(source, repo):
    file_digests(source, repo, [digest(1, DAYS[0])])

    with pytest.raises(FilingError, match="already filed"):
        plan_filing(source, [digest(1, DAYS[3])], repo_root=repo)


def test_a_chronicle_holding_something_else_is_refused(source, repo):
    write(repo / CHRONICLE / "notes.txt", "?")

    with pytest.raises(FilingError, match="neither a Period nor a Digest"):
        plan_filing(source, [digest(1, DAYS[0])], repo_root=repo)


def test_a_folder_without_its_claude_file_is_not_a_period(source, repo):
    write(repo / CHRONICLE / "1-2026-01-01" / "1-video-1.md", digest(1, DAYS[0]))

    with pytest.raises(FilingError, match=r"no CLAUDE\.md"):
        plan_filing(source, [digest(2, DAYS[1])], repo_root=repo)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("[[a/b]]", "[[x/y]]"),
        ("[[a/b|libellé]]", "[[x/y|libellé]]"),
        ("![[a/b.md#Titre]]", "![[x/y.md#Titre]]"),
        ("[[a/bc]] [[ a/b ]]", "[[a/bc]] [[x/y]]"),
        ("| [[a/b\\|libellé]] |", "| [[x/y\\|libellé]] |"),
        ("| [[a/b.md\\|libellé]] |", "| [[x/y.md\\|libellé]] |"),
    ],
)
def test_a_wikilink_follows_a_move_whatever_its_form(text, expected):
    assert rewrite_links(text, {"a/b": "x/y"}) == expected


def test_wikipol_file_files_and_summarizes_on_the_pinned_model(source, repo, monkeypatch, capsys):
    drafts: list[str] = []

    class FakeCli:
        def __call__(self, skill, prompt, model):
            drafts.append(model)
            return "---\npreview: >-\n  La Démo soutient la thèse 1.\n---\nUn paragraphe.\n"

    monkeypatch.setattr(cli, "ClaudeCli", FakeCli)
    given = write(repo / "tmp" / "vid00000001.md", digest(1, DAYS[0]))
    sources = repo / "6-politics" / "2-sources"

    code = cli.main(["file", "--source", "demo", "--sources-dir", str(sources), str(given)])

    assert code == 0
    assert drafts == [MODEL]
    assert (repo / CHRONICLE / "1-video-1.md").is_file()
    assert given.is_file()  # filed as a copy
    out = capsys.readouterr().out
    assert f"{CHRONICLE}/1-video-1.md" in out
    assert "1 Period summarized by claude-sonnet-5-5" in out


def test_wikipol_file_refuses_a_sources_folder_outside_a_repo_s_layout(repo, capsys, tmp_path):
    given = write(repo / "tmp" / "vid00000001.md", digest(1, DAYS[0]))
    elsewhere = tmp_path / "sources"
    shutil.copytree(repo / "6-politics" / "2-sources", elsewhere)

    code = cli.main(["file", "--source", "demo", "--sources-dir", str(elsewhere), str(given)])

    assert code == 2
    assert "is not a repo's 6-politics/2-sources" in capsys.readouterr().err


def test_a_period_folder_left_with_only_hidden_files_goes(source, repo):
    file_digests(source, repo, [digest(n, DAYS[n - 1]) for n in range(1, 8)])
    write(repo / CHRONICLE / "2-2026-01-05" / ".obsidian-swap", "x")

    # Three older Digests split the first Period: the second one becomes 3-2026-01-05.
    file_digests(source, repo, [digest(n, date(2025, 12, n)) for n in (10, 11, 12)])

    assert not (repo / CHRONICLE / "2-2026-01-05").exists()
    file_digests(source, repo, [digest(9, DAYS[7])])  # and the next filing still reads it


def test_wikipol_file_refuses_a_digest_already_in_the_chronicle(source, repo, capsys):
    inside = write(repo / CHRONICLE / "1-video-1.md", digest(1, DAYS[0]))
    sources = repo / "6-politics" / "2-sources"

    code = cli.main(["file", "--source", "demo", "--sources-dir", str(sources), str(inside)])

    assert code == 2
    assert "already in the Chronicle" in capsys.readouterr().err

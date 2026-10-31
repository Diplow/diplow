"""A Period's file and its summary by `write-period`, on a fake writer: no claude."""

from datetime import date

import pytest
from conftest import write

from wikipol.chronicle.period import (
    PeriodRejected,
    check_summary,
    read_period,
    render_period,
    write_period,
)
from wikipol.chronicle.tree import Leaf, Period, Summary, assign_paths
from wikipol.config import ConfigError, load_source

MODEL = "claude-sonnet-5-5"
GOOD = "---\npreview: >-\n  La Démo défend les campagnes.\n---\nUn paragraphe sur la Period.\n"


@pytest.fixture
def source(tmp_path):
    node = tmp_path / "1-demo"
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
    return load_source(node)


def period_of_two() -> Period:
    """A Period holding a Period of two Digests and a Digest-holding sibling."""
    campaigns = "LES CAMPAGNES | ET [NOUS]"
    first = Leaf("aaaaaaaaaaa", date(2026, 1, 1), campaigns, "Le RN y recule.", "")
    second = Leaf("bbbbbbbbbbb", date(2026, 1, 3), "LA GAUCHE", "« Aller chercher » les gens.", "")
    third = Leaf("ccccccccccc", date(2026, 2, 1), "LE PS", "Le PS se recentre.", "")
    inner = Period([first, second], summary=Summary("La Démo mise sur les campagnes.", "Corps."))
    root = Period([inner, Period([third], summary=Summary("Le PS.", "Corps."))])
    assign_paths(root, "c/1-2026-01-01")
    return root


class FakeWriter:
    def __init__(self, *drafts: str) -> None:
        self.drafts = list(drafts)
        self.calls: list[tuple[str, str, str]] = []

    def __call__(self, skill: str, prompt: str, model: str) -> str:
        self.calls.append((skill, prompt, model))
        return self.drafts.pop(0)


def test_the_writer_gets_the_skill_the_pinned_model_and_every_child_s_preview(source, tmp_path):
    inner = period_of_two().children[0]
    writer = FakeWriter(GOOD)

    summary = write_period(source, inner, writer, skill_path=write(tmp_path / "s.md", "Skill."))

    assert summary == Summary("La Démo défend les campagnes.", "Un paragraphe sur la Period.")
    skill, prompt, model = writer.calls[0]
    assert (skill, model) == ("Skill.", MODEL)
    assert "attribution : la Démo" in prompt
    assert "Restituer, pas neutraliser." in prompt
    assert "Tu résumes : la Period 2026-01-01 → 2026-01-03" in prompt
    assert "Elle couvre 2 Digests, du 2026-01-01 au 2026-01-03" in prompt
    link = "c/1-2026-01-01/1-2026-01-01/1-les-campagnes-et-nous"
    assert f"## 1. [[{link}|LES CAMPAGNES - ET (NOUS)]] (2026-01-01)\n\nLe RN y recule." in prompt


def test_the_chronicle_is_summarized_whole_from_its_periods_previews(source, tmp_path):
    root = period_of_two()
    writer = FakeWriter(GOOD)

    write_period(source, root, writer, chronicle=True, skill_path=write(tmp_path / "s", "S."))

    prompt = writer.calls[0][1]
    assert "Tu résumes : la Chronicle entière de Demo, 2026-01-01 → 2026-02-01" in prompt
    assert "Ses enfants sont des Periods plus courtes" in prompt
    assert (
        "## 1. [[c/1-2026-01-01/1-2026-01-01/CLAUDE|2026-01-01 → 2026-01-03]] (2 Digests)"
        "\n\nLa Démo mise sur les campagnes." in prompt
    )


def test_a_refused_summary_goes_back_once_with_its_problems(source, tmp_path):
    inner = period_of_two().children[0]
    writer = FakeWriter("---\npreview: x\n---\n# Titre\n\n## Faux\n", GOOD)

    write_period(source, inner, writer, skill_path=write(tmp_path / "s", "S."))

    assert len(writer.calls) == 2
    assert "body line 1: no heading" in writer.calls[1][1]


def test_a_summary_refused_twice_is_kept_nowhere(source, tmp_path):
    inner = period_of_two().children[0]
    bad = "---\npreview: x\n---\n> une citation\n"

    with pytest.raises(PeriodRejected) as rejected:
        write_period(source, inner, FakeWriter(bad, bad), skill_path=write(tmp_path / "s", "S."))

    assert rejected.value.problems == ["body line 1: no Extract, they stay in the Digests"]


def test_a_source_with_an_alias_writes_no_summary(source, tmp_path):
    aliased = source.__class__(**{**source.__dict__, "model": "sonnet"})

    with pytest.raises(ConfigError, match="alias"):
        write_period(aliased, period_of_two(), FakeWriter(GOOD), skill_path=tmp_path / "s")


@pytest.mark.parametrize(
    ("preview", "body", "problem"),
    [
        ("", "Un corps.", "preview is empty"),
        ("x" * 351, "Un corps.", "preview is 351 characters, 350 at most"),
        ("Un Preview.", "  ", "the body is empty"),
        ("Un Preview.", "Un.\n\nDeux.\n\nTrois.\n\nQuatre.", "the body has 4 paragraphs"),
        ("Un Preview.", "Voir [[ailleurs|là]].", "wikilink to [[ailleurs]]"),
        ("Un Preview.", "La Démo dit « reculer partout ».", "« reculer partout » is quoted"),
        ("« Le RN gagne ».", "Un corps.", "« Le RN gagne » is quoted"),
    ],
)
def test_what_a_summary_is_refused_for(preview, body, problem):
    problems = check_summary(preview, body, period_of_two().children[0])

    assert any(problem in line for line in problems), problems


def test_a_summary_may_link_its_children_and_quote_their_previews():
    inner = period_of_two().children[0]
    link = "c/1-2026-01-01/1-2026-01-01/2-la-gauche"
    body = f"La Démo veut « aller chercher » les gens, voir [[{link}|la gauche]]."

    assert check_summary("Un Preview.", body, inner) == []


def test_a_period_file_reads_back_its_title_and_summary():
    inner = period_of_two().children[0]
    text = render_period(inner)

    assert read_period(text) == (
        "2026-01-01 → 2026-01-03",
        Summary("La Démo mise sur les campagnes.", "Corps."),
    )
    assert text.endswith(
        "## Contenu\n\n"
        "1. [[c/1-2026-01-01/1-2026-01-01/1-les-campagnes-et-nous|LES CAMPAGNES - ET (NOUS)]]"
        " (2026-01-01)\n"
        "2. [[c/1-2026-01-01/1-2026-01-01/2-la-gauche|LA GAUCHE]] (2026-01-03)\n"
    )


def test_a_chronicle_written_by_hand_reads_as_a_summary_without_contents():
    text = "---\ntitle: Chronicle\npreview: >-\n  Les Digests.\n---\n# Chronicle\n\nVide.\n"

    assert read_period(text) == ("Chronicle", Summary("Les Digests.", "Vide."))


def test_the_skill_file_exists_beside_write_digest():
    from wikipol.chronicle.period import SKILL_PATH

    assert (SKILL_PATH.parents[1] / "write-digest" / "SKILL.md").is_file()
    assert "name: write-period" in SKILL_PATH.read_text(encoding="utf-8")

"""The known names: seeded from a frozen vault, read back, and picked for one Publication."""

import pytest
from conftest import write

from wikipol.digest.mentions import VocabularyError
from wikipol.digest.names import (
    KnownName,
    check_known_names,
    load_names,
    names_said,
    render_names,
    seed_names,
)
from wikipol.digest.raw_text import parse_raw


@pytest.fixture
def vault(tmp_path):
    vault = tmp_path / "Legacy" / "Demo"
    write(
        vault / "Individus" / "Adam Traore.md",
        """
        ---
        aliases: [Adama Traoré]
        ---
        # Adam Traore
        """,
    )
    write(
        vault / "Individus" / "Sylvie Tremouille.md",
        "---\naliases: [Sylvie Trémouille, Tremouille]\n---\n# Sylvie Tremouille\n",
    )
    write(vault / "Individus" / "Le Media.md", "---\naliases: Media\n---\n# Le Média TV\n")
    write(
        vault / "Organisations" / "Confederation Paysanne.md",
        "---\naliases: [Confédération Paysanne, La Conf]\n---\nPas de titre.\n",
    )
    return vault


def test_a_note_gives_its_heading_or_an_accented_alias_and_the_other_forms(vault):
    assert seed_names([vault]) == [
        KnownName("Adam Traore", "personne", ("Adama Traoré",)),
        KnownName("Le Média TV", "personne", ("Le Media", "Media")),
        KnownName("Sylvie Trémouille", "personne", ("Tremouille",)),
        KnownName("Confédération Paysanne", "organisation", ("La Conf",)),
    ]


def test_a_name_kept_wins_over_a_note_named_by_one_of_its_forms(vault):
    kept = [KnownName("Adama Traoré", "personne", ("Adam Traore",))]

    names = seed_names([vault], kept=kept)

    assert names[0] == kept[0]
    assert [n.name for n in names].count("Adam Traore") == 0
    assert len(names) == 4


def test_notes_that_share_an_alias_are_two_names_and_an_index_note_none(vault):
    write(vault / "Individus" / "CLAUDE.md", "# Fiches Individus\n\nUne fiche par personne.\n")
    write(vault / "Individus" / "Alexandria Ocasio-Cortez.md", "---\naliases: [AOC]\n---\n")
    write(vault / "Individus" / "Amelie Oudea-Castera.md", "---\naliases: [AOC]\n---\n")

    names = [n.name for n in seed_names([vault])]

    assert {"Alexandria Ocasio-Cortez", "Amelie Oudea-Castera"} <= set(names)
    assert "Fiches Individus" not in names


def test_the_names_file_reads_back(vault, tmp_path):
    names = seed_names([vault])
    path = write(tmp_path / "noms.yaml", render_names(names))

    assert sorted(load_names(path), key=lambda n: n.name) == sorted(names, key=lambda n: n.name)
    assert "  - {name: Confédération Paysanne, aliases: [La Conf]}\n" in path.read_text()


@pytest.mark.parametrize(
    "text",
    [
        "personne: {name: x}\n",
        "personne:\n  - {name: x, alias: y}\n",
        "personne:\n  - {aliases: [y]}\n",
    ],
)
def test_a_malformed_names_file_is_refused(tmp_path, text):
    with pytest.raises(VocabularyError, match=r"is not|must list"):
        load_names(write(tmp_path / "noms.yaml", text))


def test_the_names_said_are_those_a_form_of_which_the_raw_or_the_title_says():
    names = [
        KnownName("Adama Traoré", "personne", ("Adam Traore",)),
        KnownName("Assa Traoré", "personne"),
        KnownName("Olivier Besancenot", "personne", ("Bezano",)),
        KnownName("Confédération Paysanne", "organisation", ("La Conf",)),
    ]
    raw = parse_raw("0:00\n\nLa mort d'Adam traore, et Bezano en parle.\n")

    said = names_said(names, raw, "LA CONFÉDÉRATION PAYSANNE RÉPOND")

    assert [n.name for n in said] == [
        "Adama Traoré",
        "Olivier Besancenot",
        "Confédération Paysanne",
    ]


def test_a_mention_named_by_a_known_alias_is_told_the_canonical_name():
    names = [
        KnownName("Johanna Rolland", "personne", ("Johanna Roland", "Rolland")),
        KnownName("Parti socialiste", "organisation", ("PS",)),
        KnownName("Pascal Rolland", "personne", ("Rolland",)),
    ]
    mentions = [
        {"name": "Johanna Roland"},
        {"name": "PARTI SOCIALISTE"},  # the canonical name, case aside
        {"name": "Rolland"},  # two known names share it
        {"name": "Inconnu"},
        "pas une mention",
    ]

    assert check_known_names(mentions, names) == [
        "mention 'Johanna Roland': the known names write it 'Johanna Rolland'; "
        "the captions' spelling goes in heard_as"
    ]
    assert check_known_names(None, names) == []

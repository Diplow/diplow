"""The known names: seeded from a frozen vault, read back, and picked for one Publication."""

import pytest
from conftest import write

from wikipol.digest.mentions import VocabularyError
from wikipol.digest.names import KnownName, load_names, names_said, render_names, seed_names
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


def test_a_name_kept_wins_over_a_note_naming_it_by_any_form(vault):
    kept = [KnownName("Adama Traoré", "personne", ("Adam Traore",))]

    names = seed_names([vault], kept=kept)

    assert names[0] == kept[0]
    assert [n.name for n in names].count("Adam Traore") == 0
    assert len(names) == 4


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

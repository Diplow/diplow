"""A Digest's mentions and relations, checked against the vocabulary and the Raw."""

import re
import textwrap
from datetime import date

import pytest
import yaml

from wikipol.digest.format import DigestFields, check_digest, render
from wikipol.digest.mentions import (
    VOCABULARY_PATH,
    NewTerm,
    VocabularyError,
    add_terms,
    check_mentions,
    load_vocabulary,
    read_new_terms,
    with_terms,
)
from wikipol.digest.raw_text import parse_raw

VIDEO = "aaaaaaaaaaa"
RAW = parse_raw(
    """0:00

Bonjour, ici Pascal Boniface. On reçoit aujourd'hui la sœur d'Adam Traore.


0:30

Le comité vérité et justice pour Adama a publié un livre, Lettre à Adama.
"""
)

VOCABULARY = """\
kinds:
  personne:
    définition: Une personne.
    labels:
      chercheur: {définition: Étudie., statut: accepté}
      témoin: {définition: Rapporte ce qu'il a vu., statut: accepté}
      militante: {définition: Agit pour une cause., statut: proposé, introduit_par: a/b/1-x}
      victime: {définition: A subi., statut: accepté, remplacé_par: témoin}
    qualifiers:
      animateur: {définition: Mène la Publication., statut: accepté}
      sujet: {définition: La Publication parle de lui., statut: accepté}
  organisation:
    définition: Un groupe.
    labels:
      association: {définition: Une association., statut: accepté}
    qualifiers:
      sujet: {définition: La Publication parle d'elle., statut: accepté}
  œuvre:
    définition: Une œuvre.
    labels:
      livre: {définition: Un livre., statut: accepté}
    qualifiers: {}
relations:
  dirige: {définition: Dirige., from: [personne], to: [organisation], statut: accepté}
  auteur: {définition: A écrit., from: [personne, organisation], to: [œuvre], statut: accepté}
  fonde:
    définition: A fondé.
    from: [personne]
    to: [organisation]
    statut: accepté
    remplacé_par: dirige
"""

BONIFACE = {"name": "Pascal Boniface", "kind": "personne", "labels": ["chercheur"]}
ADAMA = {
    "name": "Adama Traoré",
    "kind": "personne",
    "labels": ["témoin"],
    "heard_as": "Adam Traore",
}
COMITE = {"name": "Comité Vérité et Justice pour Adama", "kind": "organisation"}
LIVRE = {"name": "Lettre à Adama", "kind": "œuvre", "labels": ["livre"]}


@pytest.fixture
def vocabulary(tmp_path):
    path = tmp_path / "vocabulaire.yaml"
    path.write_text(VOCABULARY, encoding="utf-8")
    return load_vocabulary(path)


def check(vocabulary, mentions=None, relations=None):
    data = {}
    if mentions is not None:
        data["mentions"] = mentions
    if relations is not None:
        data["relations"] = relations
    return check_mentions(data, RAW, vocabulary)


def test_the_repo_s_vocabulary_loads():
    vocabulary = load_vocabulary(VOCABULARY_PATH)

    assert set(vocabulary.kinds) == {
        "personne",
        "organisation",
        "lieu",
        "événement",
        "œuvre",
        "texte",
    }
    assert vocabulary.relations["auteur"].to_kinds == ("œuvre", "texte")


def test_a_digest_without_mentions_needs_no_vocabulary():
    assert check_mentions({"title": "x"}, RAW, None) == []
    assert check_mentions({"mentions": []}, RAW, None) == [
        "mentions and relations can't be checked without the vocabulary"
    ]


def test_mentions_and_relations_that_hold(vocabulary):
    mentions = [
        {**BONIFACE, "qualifiers": ["animateur"]},
        {**ADAMA, "qualifiers": ["sujet"], "unsure": True},
        COMITE,
        LIVRE,
    ]
    relations = [{"from": COMITE["name"], "relation": "auteur", "to": LIVRE["name"]}]

    assert check(vocabulary, mentions, relations) == []


def test_a_proposed_term_is_known(vocabulary):
    assert check(vocabulary, [{**BONIFACE, "labels": ["militante"]}]) == []


def test_the_name_is_found_in_the_raw_case_and_accents_aside(vocabulary):
    # The Raw says "Adam Traore" and "comité vérité": the canonical spellings differ.
    assert check(vocabulary, [{**COMITE, "name": "COMITE VERITE et justice pour Adama"}]) == []
    assert check(vocabulary, [{**ADAMA, "heard_as": "Adama Traore"}]) == [
        "mention 'Adama Traoré': 'Adama Traore' is in neither the Raw nor the title"
    ]
    assert check(vocabulary, [{"name": "Adama Traoré", "kind": "personne"}]) == [
        "mention 'Adama Traoré': 'Adama Traoré' is in neither the Raw nor the title; "
        "heard_as gives the captions' spelling"
    ]


def test_a_name_in_the_title_and_not_the_raw_holds(vocabulary):
    data = {
        "title": "J'ai lu « Lettre à Adama » d'Assa Traoré",
        "mentions": [
            {"name": "Assa Traoré", "kind": "personne"},
            {"name": "Assa", "kind": "personne"},
        ],
    }

    assert check_mentions(data, RAW, vocabulary) == []
    assert check(vocabulary, [{"name": "Assa Traoré", "kind": "personne"}]) == [
        "mention 'Assa Traoré': 'Assa Traoré' is in neither the Raw nor the title; "
        "heard_as gives the captions' spelling"
    ]


def test_a_name_across_an_empty_block_is_found(vocabulary):
    raw = parse_raw("0:00\n\nOn reçoit Assa\n\n0:30\n\n\n1:00\n\nTraoré ce soir.\n")

    assert (
        check_mentions({"mentions": [{"name": "Assa Traoré", "kind": "personne"}]}, raw, vocabulary)
        == []
    )


def test_a_malformed_name_does_not_stop_the_relations(vocabulary):
    relations = [{"from": BONIFACE["name"], "relation": "dirige", "to": COMITE["name"]}]

    assert check(vocabulary, [BONIFACE, COMITE, {"name": ["x"], "kind": "lieu"}], relations) == [
        "mention 3 needs a name"
    ]


def test_kind_labels_and_qualifiers_come_from_the_vocabulary(vocabulary):
    assert check(vocabulary, [{**BONIFACE, "kind": "concept"}]) == [
        "mention 'Pascal Boniface': kind 'concept' is not one of personne, organisation, œuvre"
    ]
    assert check(vocabulary, [{**BONIFACE, "labels": ["livre"], "qualifiers": ["invité"]}]) == [
        "mention 'Pascal Boniface': 'livre' is not a label of a personne in the vocabulary",
        "mention 'Pascal Boniface': 'invité' is not a qualifier of a personne in the vocabulary",
    ]


def test_a_retired_term_names_its_replacement(vocabulary):
    assert check(vocabulary, [{**BONIFACE, "labels": ["victime"]}]) == [
        "mention 'Pascal Boniface': 'victime' is retired, replaced by 'témoin'"
    ]
    relations = [{"from": BONIFACE["name"], "relation": "fonde", "to": COMITE["name"]}]
    assert check(vocabulary, [BONIFACE, COMITE], relations) == [
        "relation 1: 'fonde' is retired, replaced by 'dirige'"
    ]


def test_malformed_mentions_are_named(vocabulary):
    mentions = [
        "Pascal Boniface",
        {"kind": "personne"},
        {**BONIFACE, "role": "hôte", "labels": "chercheur", "unsure": "oui", "heard_as": ""},
    ]

    assert check(vocabulary, mentions) == [
        "mention 1 must be a mapping",
        "mention 2 needs a name",
        "mention 'Pascal Boniface': unknown keys role",
        "mention 'Pascal Boniface': labels must be a list",
        "mention 'Pascal Boniface': heard_as must be the name as the captions spell it",
        "mention 'Pascal Boniface': unsure is true, or left out",
    ]
    assert check(vocabulary, {"name": "x"}, "y") == [
        "mentions must be a list",
        "relations must be a list",
    ]


def test_a_mention_listed_twice_is_refused(vocabulary):
    twice = [BONIFACE, {**BONIFACE, "name": "pascal BONIFACE", "labels": []}]

    assert check(vocabulary, twice) == ["mention 'pascal BONIFACE' is listed twice"]
    # The first one keeps its kind: a relation reads it, not the duplicate's.
    relations = [{"from": BONIFACE["name"], "relation": "dirige", "to": COMITE["name"]}]
    duplicate = {**BONIFACE, "kind": "organisation", "labels": []}
    assert check(vocabulary, [BONIFACE, duplicate, COMITE], relations) == [
        "mention 'Pascal Boniface' is listed twice"
    ]


def test_a_relation_links_two_mentions_of_the_digest_of_allowed_kinds(vocabulary):
    relations = [
        {"from": "Assa Traoré", "relation": "dirige", "to": COMITE["name"]},
        {"from": LIVRE["name"], "relation": "auteur", "to": BONIFACE["name"]},
        {"from": BONIFACE["name"], "relation": "soutient", "to": COMITE["name"]},
        {"from": BONIFACE["name"], "relation": "dirige"},
        {"from": BONIFACE["name"], "relation": "dirige", "to": COMITE["name"]},
        {"from": BONIFACE["name"], "relation": "dirige", "to": COMITE["name"]},
    ]

    assert check(vocabulary, [BONIFACE, COMITE, LIVRE], relations) == [
        "relation 1: from 'Assa Traoré' is not a mention of this Digest",
        "relation 2: auteur goes from personne or organisation, and 'Lettre à Adama' is a œuvre",
        "relation 2: auteur goes to œuvre, and 'Pascal Boniface' is a personne",
        "relation 3: 'soutient' is not in the vocabulary's relations",
        "relation 4 holds from, relation and to, and only them",
        "relation 6 repeats an earlier one",
    ]


def test_check_digest_reads_the_mentions_from_the_frontmatter(vocabulary):
    fields = DigestFields(
        title="Lettre à Adama",
        parent="6-politics/2-sources/2-boniface/1-chronicle",
        source="boniface",
        youtube_id=VIDEO,
        published=date(2026, 10, 28),
        duration=60,
        ingested=date(2026, 10, 31),
        model="claude-sonnet-5-5",
    )
    claims = (
        "## 1. Le comité publie un livre.\n\n"
        f"> [0:30](https://www.youtube.com/watch?v={VIDEO}&t=30s) "
        "« a publié un livre, Lettre à Adama »"
    )
    text = render(fields, "Le comité publie un livre.", claims)
    mentions = yaml.safe_dump(
        {"mentions": [{**BONIFACE, "labels": ["inconnu"]}]}, allow_unicode=True
    )
    with_mentions = text.replace("\n---\n# ", f"\n{mentions}---\n# ", 1)

    assert check_digest(text, RAW, vocabulary=vocabulary) == []
    assert check_digest(with_mentions, RAW, vocabulary=vocabulary) == [
        "mention 'Pascal Boniface': 'inconnu' is not a label of a personne in the vocabulary"
    ]


def write(tmp_path, text):
    path = tmp_path / "vocabulaire.yaml"
    path.write_text(textwrap.dedent(text), encoding="utf-8")
    return path


@pytest.mark.parametrize(
    ("text", "problem"),
    [
        ("kinds: {}\nrelations: {}\n", "`kinds:` must map each kind"),
        ("kinds: {a: 1}\n", "must hold `kinds:` and `relations:`"),
        (
            "kinds:\n  Personne: {définition: x, labels: {}, qualifiers: {}}\nrelations: {}\n",
            "kinds.Personne: a term is lowercase words joined by -",
        ),
        (
            "kinds:\n  personne: {définition: x, labels: {}}\nrelations: {}\n",
            "kinds.personne must hold `définition`, `labels` and `qualifiers`",
        ),
        (
            "kinds:\n  personne:\n    définition: x\n    qualifiers: {}\n"
            "    labels: {élu: {définition: x, statut: validé}}\nrelations: {}\n",
            "kinds.personne.labels.élu: statut must be accepté or proposé",
        ),
        (
            "kinds:\n  personne:\n    définition: x\n    qualifiers: {}\n"
            "    labels: {élu: {définition: x, statut: proposé}}\nrelations: {}\n",
            "kinds.personne.labels.élu: a proposé term, and only one, names its Digest",
        ),
        (
            "kinds:\n  personne:\n    définition: x\n    qualifiers: {}\n"
            "    labels: {élu: {définition: x, statut: accepté, remplacé_par: maire}}\n"
            "relations: {}\n",
            "kinds.personne.labels.élu: remplacé_par 'maire' is not a term in use beside it",
        ),
        (
            "kinds:\n  personne: {définition: x, labels: {}, qualifiers: {}}\n"
            "relations:\n  dirige: {définition: x, statut: accepté,"
            " from: [personne], to: [lieu]}\n",
            "relations.dirige.to must list kinds of `kinds:`",
        ),
        ("kinds: [\n", "is not valid YAML"),
        (
            "kinds:\n  personne: {définition: x, labels: {}, qualifiers: {}}\n"
            "relations:\n  dirige: {définition: x, statut: accepté,"
            " from: [{a: 1}], to: [personne]}\n",
            "relations.dirige.from must list kinds of `kinds:`",
        ),
        (
            'kinds:\n  personne: {définition: "deux\\nlignes", labels: {}, qualifiers: {}}\n'
            "relations: {}\n",
            "kinds.personne: définition must be one line of text",
        ),
    ],
)
def test_a_malformed_vocabulary_is_refused(tmp_path, text, problem):
    with pytest.raises(VocabularyError, match=re.escape(problem)):
        load_vocabulary(write(tmp_path, text))


def test_a_missing_vocabulary_is_refused(tmp_path):
    with pytest.raises(VocabularyError, match="can't be read"):
        load_vocabulary(tmp_path / "absent.yaml")
    path = tmp_path / "latin1.yaml"
    path.write_bytes("kinds: {é: 1}".encode("latin-1"))
    with pytest.raises(VocabularyError, match="can't be read"):
        load_vocabulary(path)


def test_a_host_needs_not_be_heard(vocabulary):
    host = {"name": "Jean Hôte", "kind": "personne", "qualifiers": ["animateur"]}

    assert check_mentions({"mentions": [host]}, RAW, vocabulary, hosts=["Jean Hote"]) == []
    assert check_mentions({"mentions": [host]}, RAW, vocabulary) == [
        "mention 'Jean Hôte': 'Jean Hôte' is in neither the Raw nor the title; "
        "heard_as gives the captions' spelling"
    ]
    misheard = {**host, "heard_as": "Jean Ote"}  # a spelling the captions are said to give
    assert check_mentions({"mentions": [misheard]}, RAW, vocabulary, hosts=["Jean Hôte"]) == [
        "mention 'Jean Hôte': 'Jean Ote' is in neither the Raw nor the title"
    ]


def test_new_terms_are_read_and_the_known_ones_left_out(vocabulary):
    terms, problems = read_new_terms(
        [
            {"label": "humoriste", "kind": "personne", "definition": "Fait rire."},
            {"qualifier": "sujet", "kind": "personne", "definition": "Déjà là."},
            {"label": "humoriste", "kind": "personne", "definition": "Deux fois."},
            {
                "relation": "soutient",
                "from": ["personne"],
                "to": ["organisation"],
                "definition": "Prend son parti.",
            },
        ],
        vocabulary,
    )

    assert problems == []
    assert terms == [
        NewTerm("labels", "humoriste", "Fait rire.", "personne"),
        NewTerm(
            "relations", "soutient", "Prend son parti.", None, ("personne",), ("organisation",)
        ),
    ]
    extended = with_terms(vocabulary, terms, "boniface/aaaaaaaaaaa")
    assert extended.kinds["personne"].labels["humoriste"].status == "proposé"
    assert extended.relations["soutient"].term.introduced_by == "boniface/aaaaaaaaaaa"
    assert "humoriste" not in vocabulary.kinds["personne"].labels


def test_malformed_new_terms_are_named(vocabulary):
    _, problems = read_new_terms(
        [
            "humoriste",
            {"label": "Humoriste", "kind": "personne", "definition": "x"},
            {"label": "drôle", "kind": "concept", "definition": "x"},
            {"label": "drôle", "kind": "personne"},
            {"label": "victime", "kind": "personne", "definition": "x"},
            {"relation": "aime", "from": ["personne"], "to": ["idée"], "definition": "x"},
            {"label": "x", "kind": "personne", "definition": "deux\nlignes"},
        ],
        vocabulary,
    )

    assert problems == [
        "new term 1 names one label, qualifier or relation",
        "new term 2: 'Humoriste' is not lowercase words joined by -",
        "new term 3: kind 'concept' is not one of the vocabulary",
        "new term 4 holds definition, kind, label, and only them",
        "new term 5: 'victime' is retired, replaced by 'témoin'",
        "new term 6: from and to list kinds of the vocabulary",
        "new term 7: 'x' needs a definition of one line",
    ]
    assert read_new_terms({"label": "x"}, vocabulary) == ([], ["new_terms must be a list"])


def test_added_terms_join_their_group_and_leave_the_rest_as_it_was(tmp_path):
    path = write(tmp_path, VOCABULARY)
    terms = [
        NewTerm("labels", "humoriste", "Fait rire, « sur scène ».", "personne"),
        NewTerm("qualifiers", "cité", "Lue à voix haute.", "œuvre"),
        NewTerm(
            "relations", "soutient", "Prend son parti.", None, ("personne",), ("organisation",)
        ),
    ]

    add_terms(terms, "boniface/aaaaaaaaaaa", path=path)

    text = path.read_text(encoding="utf-8")
    assert text.startswith(VOCABULARY.split("      militante")[0])
    assert (
        "      victime: {définition: A subi., statut: accepté, remplacé_par: témoin}\n"
        '      humoriste: {définition: "Fait rire, « sur scène ».", statut: proposé, '
        "introduit_par: boniface/aaaaaaaaaaa}\n    qualifiers:\n"
    ) in text
    assert '    qualifiers:\n      cité: {définition: "Lue à voix haute."' in text
    vocabulary = load_vocabulary(path)
    assert vocabulary.kinds["personne"].labels["humoriste"].definition == (
        "Fait rire, « sur scène »."
    )
    assert vocabulary.kinds["œuvre"].qualifiers["cité"].status == "proposé"
    assert vocabulary.relations["soutient"].to_kinds == ("organisation",)
    assert vocabulary.relations["fonde"].term.replaced_by == "dirige"


def test_a_term_that_would_break_the_vocabulary_is_not_written(tmp_path):
    path = write(tmp_path, VOCABULARY)

    with pytest.raises(VocabularyError, match="would break the vocabulary"):
        add_terms([NewTerm("labels", "yes", "Un booléen pour YAML.", "personne")], "a/b", path=path)
    assert path.read_text(encoding="utf-8") == VOCABULARY
    assert not (tmp_path / ".vocabulaire.yaml.new").exists()
    # A draft can't propose it: YAML would read it as a boolean.
    _, problems = read_new_terms(
        [{"label": "yes", "kind": "personne", "definition": "x"}], load_vocabulary(path)
    )
    assert problems == ["new term 1: 'yes' reads as True in YAML"]

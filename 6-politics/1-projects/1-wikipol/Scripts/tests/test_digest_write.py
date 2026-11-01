"""`wikipol digest` on a fake writer and an in-memory bucket: no claude, no Scaleway."""

import json
import subprocess
from datetime import date
from pathlib import Path

import pytest
from conftest import write

from wikipol.claude import ClaudeCli, WriterFailed, split_draft
from wikipol.config import ConfigError, load_source
from wikipol.digest.format import split_digest
from wikipol.digest.write import DigestRejected, linkable_digests, write_digest
from wikipol.raw_store import InMemoryRawStore, RawMeta

VIDEO = "aaaaaaaaaaa"
MODEL = "claude-sonnet-5-5"
TODAY = date(2026, 10, 31)
RAW = f"""---
youtube_id: {VIDEO}
---

0:00

La gauche doit aller chercher les campagnes, le Rassemblement national y progresse.


0:30

Les services publics se retirent et le vote suit leur départ, partout.
"""

GOOD_DRAFT = f"""---
preview: >-
  La PaduTeam soutient que la gauche doit reconquérir les campagnes.
---
## 1. Le RN progresse dans les campagnes.

> [0:00](https://www.youtube.com/watch?v={VIDEO}&t=0s) « le Rassemblement national y progresse »

## 2. Le vote suit le départ des services publics.

> [0:30](https://www.youtube.com/watch?v={VIDEO}&t=30s) « les services publics se retirent et »
"""

# The second quote linked to the block before the one it is in.
BAD_DRAFT = GOOD_DRAFT.replace("[0:30]", "[0:00]").replace("&t=30s", "&t=0s")


@pytest.fixture
def source(tmp_path):
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
    write(
        tmp_path / "6-politics" / "Legacy" / "Demo" / "Videos" / "Une fiche.md",
        f"""
        ---
        type: vidéo
        date: 2026-03-28
        youtube_id: "{VIDEO}"
        ---
        # Une fiche legacy

        1. Une thèse de l'ancienne fiche[^1].
        """,
    )
    return load_source(node)


@pytest.fixture
def store():
    store = InMemoryRawStore()
    store.put("demo", VIDEO, RAW.encode(), RawMeta("CAMPAGNES : LA GAUCHE Y VA ?", None, 75))
    return store


class FakeWriter:
    def __init__(self, *drafts: str) -> None:
        self.drafts = list(drafts)
        self.calls: list[tuple[str, str, str]] = []

    def __call__(self, skill: str, prompt: str, model: str) -> str:
        self.calls.append((skill, prompt, model))
        return self.drafts.pop(0)


def digest(source, store, writer, **kwargs):
    return write_digest(
        source, VIDEO, store, writer, parent="demo/1-chronicle", today=TODAY, **kwargs
    )


def test_the_digest_holds_the_pipeline_s_fields_and_the_writer_s_claims(source, store):
    writer = FakeWriter(GOOD_DRAFT)

    result = digest(source, store, writer)

    frontmatter, body = split_digest(result.text)
    assert frontmatter["title"] == "CAMPAGNES : LA GAUCHE Y VA ?"
    assert frontmatter["preview"] == (
        "La PaduTeam soutient que la gauche doit reconquérir les campagnes."
    )
    assert frontmatter["published"] == date(2026, 3, 28)  # from the legacy note
    assert frontmatter["duration"] == 75
    assert frontmatter["model"] == MODEL
    assert frontmatter["raw"] == f"demo/{VIDEO}.md"
    assert frontmatter["parent"] == "demo/1-chronicle"
    assert body.startswith("# CAMPAGNES : LA GAUCHE Y VA ?\n\n## 1. Le RN progresse")
    assert result.drafts == 1


def test_the_writer_runs_the_skill_on_the_pinned_model_with_every_input(source, store):
    writer = FakeWriter(GOOD_DRAFT)

    digest(source, store, writer, skill_path=write(Path(source.node) / "skill.md", "La skill."))

    skill, prompt, model = writer.calls[0]
    assert (skill, model) == ("La skill.", MODEL)
    assert "attribution : la Démo" in prompt
    assert "Restituer, pas neutraliser." in prompt  # the Source's editorial CLAUDE.md
    assert "# Une fiche legacy" in prompt
    assert "Les services publics se retirent" in prompt  # the Raw
    assert "Durée : 75 s (1:15)" in prompt
    assert f"{VIDEO}&t=<secondes>s" in prompt
    assert "n'écris aucun wikilink" in prompt


def test_a_rejected_draft_goes_back_once_with_what_was_wrong(source, store):
    writer = FakeWriter(BAD_DRAFT, GOOD_DRAFT)

    result = digest(source, store, writer)

    assert result.drafts == 2
    retry = writer.calls[1][1]
    assert retry.startswith(writer.calls[0][1])
    assert "is not in the Raw's block at 0 s" in retry
    assert BAD_DRAFT.strip() in retry


def test_two_rejected_drafts_keep_nothing(source, store):
    with pytest.raises(DigestRejected) as rejected:
        digest(source, store, FakeWriter(BAD_DRAFT, BAD_DRAFT))

    assert (
        "claim 2: the quote « les services publics se retirent et »" in (rejected.value.problems[0])
    )
    assert rejected.value.draft.startswith("---\ntitle:")


def test_a_source_without_a_pinned_model_writes_no_digest(tmp_path, store):
    write(tmp_path / "1-demo" / "source.yaml", "source:\n  name: Demo\n  slug: demo\n")
    writer = FakeWriter(GOOD_DRAFT)

    with pytest.raises(ConfigError, match=r"claude\.default_model"):
        digest(load_source(tmp_path / "1-demo"), store, writer)
    assert writer.calls == []


def test_an_alias_in_source_yaml_is_refused(tmp_path):
    write(
        tmp_path / "1-demo" / "source.yaml",
        "source:\n  name: Demo\n  slug: demo\nclaude:\n  default_model: sonnet\n",
    )

    with pytest.raises(ConfigError, match="'sonnet' is an alias"):
        load_source(tmp_path / "1-demo")


def test_a_draft_s_fence_and_title_are_dropped():
    preview, claims = split_draft(f"```markdown\n{GOOD_DRAFT}```")
    assert preview.startswith("La PaduTeam soutient")
    assert claims.startswith("## 1.")

    _, claims = split_draft("---\npreview: x\n---\n# Un titre\n\n## 1. Une.\n")
    assert claims == "## 1. Une."


def test_the_digests_already_in_the_chronicle_may_be_cited(source, store, tmp_path):
    period = source.chronicle / "1-2026"
    write(period / "CLAUDE.md", "---\ntitle: 2026\n---\n")
    write(period / "1-une-autre.md", "---\ntitle: UNE AUTRE\ndigest_version: 1\n---\n")
    target = "6-politics/2-sources/1-demo/1-chronicle/1-2026/1-une-autre"
    cites = GOOD_DRAFT.replace("## 2.", f"Comme dans [[{target}|l'autre]].\n\n## 2.")
    writer = FakeWriter(cites)

    linkable = linkable_digests(source, repo_root=tmp_path)
    digest(source, store, writer, linkable=linkable)

    assert linkable == {target: "UNE AUTRE"}
    assert f"- [[{target}|UNE AUTRE]]" in writer.calls[0][1]


class FakeClaude:
    def __init__(self, answer, returncode=0, stderr=""):
        self.answer, self.returncode, self.stderr = answer, returncode, stderr
        self.calls = []

    def __call__(self, command, stdin, cwd, timeout):
        self.calls.append((list(command), stdin, cwd, timeout))
        stdout = self.answer if isinstance(self.answer, str) else json.dumps(self.answer)
        return subprocess.CompletedProcess(command, self.returncode, stdout, self.stderr)


def answer(result="le brouillon", models=(MODEL,), is_error=False):
    return {
        "type": "result",
        "is_error": is_error,
        "result": result,
        "modelUsage": {name: {"outputTokens": 10} for name in models},
    }


def test_claude_runs_with_the_skill_the_pinned_model_and_no_tool():
    run = FakeClaude(answer())

    assert ClaudeCli(run)("La skill.", "Le Raw.", MODEL) == "le brouillon"

    command, stdin, cwd, _ = run.calls[0]
    assert command[:4] == ["claude", "-p", "--model", MODEL]
    assert command[command.index("--system-prompt") + 1] == "La skill."
    assert command[command.index("--tools") + 1] == ""
    assert "--strict-mcp-config" in command
    assert command[command.index("--output-format") + 1] == "json"
    assert stdin == "Le Raw."
    assert not cwd.exists()  # an empty folder of its own, gone once claude is done


def test_an_answer_from_another_model_is_refused():
    with pytest.raises(WriterFailed, match="claude-haiku-4-5, not claude-sonnet-5-5"):
        ClaudeCli(FakeClaude(answer(models=("claude-haiku-4-5",))))("s", "p", MODEL)


def test_a_failed_claude_is_a_writer_failure():
    with pytest.raises(WriterFailed, match="claude failed: usage limit"):
        ClaudeCli(FakeClaude(answer("usage limit", is_error=True), returncode=1))("s", "p", MODEL)
    with pytest.raises(WriterFailed, match="no JSON answer: not logged in"):
        ClaudeCli(FakeClaude("", returncode=1, stderr="not logged in"))("s", "p", MODEL)


def test_a_claude_timeout_is_a_writer_failure():
    def hang(command, stdin, cwd, timeout):
        raise subprocess.TimeoutExpired(command, timeout)

    with pytest.raises(WriterFailed, match="timed out"):
        ClaudeCli(hang)("s", "p", MODEL)


def test_check_digest_reads_a_file_against_its_raw(source, store, tmp_path):
    from wikipol.cli import check_one_digest

    good = tmp_path / "good.md"
    good.write_text(digest(source, store, FakeWriter(GOOD_DRAFT)).text, encoding="utf-8")
    sources_dir = source.node.parent

    assert check_one_digest(good, store, sources_dir) == []


@pytest.mark.parametrize(
    ("change", "complaint"),
    [
        (('youtube_id: "aaaaaaaaaaa"\n', ""), "not a YouTube id"),
        (("source: demo", "source: autre"), "no Source with slug autre"),
        (('youtube_id: "aaaaaaaaaaa"', 'youtube_id: "bbbbbbbbbbb"'), "demo/bbbbbbbbbbb.md"),
    ],
)
def test_a_digest_the_check_cannot_place_is_one_more_problem(
    source, store, tmp_path, change, complaint
):
    from wikipol.cli import check_one_digest

    path = tmp_path / "bad.md"
    text = digest(source, store, FakeWriter(GOOD_DRAFT)).text
    path.write_text(text.replace(*change), encoding="utf-8")

    problems = check_one_digest(path, store, source.node.parent)

    assert len(problems) == 1
    assert problems[0].startswith("can't be checked: ")
    assert complaint in problems[0]


def test_a_digest_written_before_a_model_change_still_checks(source, store, tmp_path):
    from wikipol.cli import check_one_digest

    path = tmp_path / "older.md"
    text = digest(source, store, FakeWriter(GOOD_DRAFT)).text
    path.write_text(text.replace(f"model: {MODEL}", "model: claude-sonnet-4-5"), encoding="utf-8")

    assert check_one_digest(path, store, source.node.parent) == []


def test_an_unreadable_digest_file_is_one_more_problem(source, store, tmp_path):
    from wikipol.cli import check_one_digest

    path = tmp_path / "latin1.md"
    path.write_bytes("---\ntitle: é\n".encode("latin-1"))

    assert check_one_digest(path, store, source.node.parent)[0].startswith("can't be read: ")
    assert check_one_digest(tmp_path / "absent.md", store, source.node.parent)[0].startswith(
        "can't be read: "
    )


def test_check_digest_holds_the_date_to_the_raw_and_the_legacy_note(source, store, tmp_path):
    from wikipol.cli import check_one_digest

    path = tmp_path / "edited.md"
    text = digest(source, store, FakeWriter(GOOD_DRAFT)).text
    path.write_text(text.replace("published: 2026-03-28", "published: 2026-03-29"), "utf-8")

    assert check_one_digest(path, store, source.node.parent) == [
        "published is datetime.date(2026, 3, 29), expected datetime.date(2026, 3, 28)"
    ]


def test_a_json_answer_that_is_not_an_object_is_a_writer_failure():
    with pytest.raises(WriterFailed, match="answered list"):
        ClaudeCli(FakeClaude([1, 2]))("s", "p", MODEL)


def test_an_untimed_raw_asks_for_extracts_without_a_link(source):
    store = InMemoryRawStore()
    body = "---\nyoutube_id: aaaaaaaaaaa\n---\n\nLa guerre au Parti socialiste commence vraiment.\n"
    store.put("demo", VIDEO, body.encode(), RawMeta("SANS HORODATAGE", None, None))
    draft = "---\npreview: La guerre commence.\n---\n## 1. La guerre.\n\n"
    draft += "> « La guerre au Parti socialiste commence »\n"
    writer = FakeWriter(draft)

    result = digest(source, store, writer)

    assert "aucun : les Extracts n'ont pas de lien" in writer.calls[0][1]
    assert result.drafts == 1


def test_a_source_built_with_an_alias_writes_no_digest(source, store):
    from dataclasses import replace

    with pytest.raises(ConfigError, match="is an alias"):
        digest(replace(source, model="sonnet"), store, FakeWriter(GOOD_DRAFT))


MENTIONS_DRAFT = GOOD_DRAFT.replace(
    "---\n## 1.",
    """mentions:
  - {name: Jean Hôte, kind: personne, labels: [humoriste], qualifiers: [animateur]}
  - {name: Rassemblement national, kind: organisation, labels: [parti], qualifiers: [sujet],
     heard_as: Rassemblement national}
new_terms:
  - {label: humoriste, kind: personne, definition: "Fait rire, sur scène ou en ligne."}
---
## 1.""",
    1,
)


@pytest.fixture
def vocabulary_path(tmp_path):
    from wikipol.digest.mentions import VOCABULARY_PATH

    path = tmp_path / ".vocabulaire" / "vocabulaire.yaml"
    path.parent.mkdir()
    path.write_text(VOCABULARY_PATH.read_text(encoding="utf-8"), encoding="utf-8")
    return path


@pytest.fixture
def names_path(tmp_path):
    return write(
        tmp_path / ".vocabulaire" / "noms.yaml",
        """
        personne:
          - {name: Jean Hôte}
          - {name: Personne Absente}
        organisation:
          - {name: Rassemblement national, aliases: [RN, Front national]}
        """,
    )


def test_the_mentions_are_written_and_a_proposed_term_joins_the_vocabulary(
    source, store, vocabulary_path, names_path
):
    from dataclasses import replace

    from wikipol.digest.mentions import load_vocabulary

    hosted = replace(source, hosts=("Jean Hôte",))
    writer = FakeWriter(MENTIONS_DRAFT)

    result = digest(hosted, store, writer, vocabulary_path=vocabulary_path, names_path=names_path)

    frontmatter, _ = split_digest(result.text)
    assert frontmatter["mentions"][0] == {
        "name": "Jean Hôte",
        "kind": "personne",
        "labels": ["humoriste"],
        "qualifiers": ["animateur"],
    }
    assert "new_terms" not in frontmatter
    assert "\n  - {name: Jean Hôte, kind: personne, labels: [humoriste]," in result.text
    term = load_vocabulary(vocabulary_path).kinds["personne"].labels["humoriste"]
    assert (term.status, term.introduced_by) == ("proposé", f"demo/{VIDEO}.md")
    prompt = writer.calls[0][1]
    assert "# Les animateurs de la Source\n\n- Jean Hôte\n" in prompt
    assert "chef-d-état: {définition:" in prompt  # the vocabulary
    assert "- Rassemblement national (organisation ; aussi : RN, Front national)" in prompt
    assert "Personne Absente" not in prompt  # a known name the Publication doesn't say


def test_a_rejected_draft_proposes_nothing(source, store, vocabulary_path, names_path):
    before = vocabulary_path.read_text(encoding="utf-8")

    with pytest.raises(DigestRejected) as rejected:
        digest(  # Jean Hôte is no host of this Source, and the Raw never names him
            source,
            store,
            FakeWriter(MENTIONS_DRAFT, MENTIONS_DRAFT),
            vocabulary_path=vocabulary_path,
            names_path=names_path,
        )

    assert rejected.value.problems == [
        "mention 'Jean Hôte': 'Jean Hôte' is in neither the Raw nor the title; "
        "heard_as gives the captions' spelling"
    ]
    assert vocabulary_path.read_text(encoding="utf-8") == before


def test_a_source_s_hosts_are_read_from_source_yaml(tmp_path):
    write(
        tmp_path / "1-demo" / "source.yaml",
        "source:\n  name: Demo\n  slug: demo\n  hosts: [Pascal Boniface]\n",
    )
    assert load_source(tmp_path / "1-demo").hosts == ("Pascal Boniface",)

    for value in ("x", "''", "false", "[]x"):
        write(
            tmp_path / "2-demo" / "source.yaml",
            f"source:\n  name: D\n  slug: d\n  hosts: {value}\n",
        )
        if value == "[]x":
            continue
        with pytest.raises(ConfigError, match=r"source\.hosts must list names"):
            load_source(tmp_path / "2-demo")


def test_a_frontmatter_yaml_can_t_read_is_named(source, store, vocabulary_path, names_path):
    broken = GOOD_DRAFT.replace(
        "---\n## 1.", "mentions:\n  - {name: Le Monde: le journal}\n---\n## 1."
    )

    with pytest.raises(DigestRejected) as rejected:
        digest(
            source,
            store,
            FakeWriter(broken, broken),
            vocabulary_path=vocabulary_path,
            names_path=names_path,
        )

    assert "the draft's frontmatter is not YAML that reads" in rejected.value.problems[0]


def test_a_known_name_corrects_the_captions_and_keeps_their_spelling(
    source, vocabulary_path, names_path
):
    store = InMemoryRawStore()
    body = RAW.replace(
        "le Rassemblement national y progresse", "Olivier Fort dit que le RN y progresse"
    )
    store.put("demo", VIDEO, body.encode(), RawMeta("CAMPAGNES : LA GAUCHE Y VA ?", None, 75))
    names_path.write_text("personne:\n  - {name: Olivier Faure, aliases: [Olivier Fort]}\n")
    claims = GOOD_DRAFT.split("---\n", 2)[2].replace(
        "le Rassemblement national y progresse", "Olivier Fort dit que le RN"
    )
    mention = "{name: %s, kind: personne, labels: [élu], qualifiers: [sujet]%s}"
    misnamed = f"---\npreview: x\nmentions:\n  - {mention % ('Olivier Fort', '')}\n---\n{claims}"
    corrected = misnamed.replace(
        mention % ("Olivier Fort", ""), mention % ("Olivier Faure", ", heard_as: Olivier Fort")
    )
    writer = FakeWriter(misnamed, corrected)

    result = digest(source, store, writer, vocabulary_path=vocabulary_path, names_path=names_path)

    assert "- Olivier Faure (personne ; aussi : Olivier Fort)" in writer.calls[0][1]
    assert "the known names write it 'Olivier Faure'" in writer.calls[1][1]
    assert split_digest(result.text)[0]["mentions"] == [
        {
            "name": "Olivier Faure",
            "kind": "personne",
            "labels": ["élu"],
            "qualifiers": ["sujet"],
            "heard_as": "Olivier Fort",
        }
    ]

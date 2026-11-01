"""A Digest's mentions and relations, and the living vocabulary they are checked against.

A mention names who or what a Publication talks about: its `kind` (personne, organisation…),
`labels` saying what it is at the Publication's date, `qualifiers` saying what it is to the
Publication, and `heard_as`, the captions' spelling, when it differs from the canonical `name`.
A relation links two mentions of the same Digest. The words come from `vocabulaire.yaml`, in
wikipol's `.vocabulaire/`, which Ulysse edits by hand; BUILD.md shows a Digest's mentions.

When no word fits, write-digest proposes one, with a definition (`new_terms` in its draft): the
Digest is checked against the vocabulary with it, and once accepted, `add_terms` writes it into
the file as `proposé`, for Ulysse to accept, rename or retire.
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import Iterable
from dataclasses import dataclass, replace
from pathlib import Path

import yaml

from wikipol.config import ConfigError
from wikipol.digest.raw_text import RawText, bare_words

# src/wikipol/digest/mentions.py -> parents: digest, wikipol, src, Scripts, 1-wikipol
VOCABULARY_PATH = Path(__file__).resolve().parents[4] / ".vocabulaire" / "vocabulaire.yaml"

STATUSES = ("accepté", "proposé")
TERM = re.compile(r"[^\W\d_]+(?:-[^\W\d_]+)*")
MENTION_KEYS = ("name", "kind", "labels", "qualifiers", "heard_as", "unsure")
RELATION_KEYS = ("from", "relation", "to")
GROUPS = {"label": "labels", "qualifier": "qualifiers", "relation": "relations"}
"""A new term's key in a draft, to the vocabulary's group it joins."""


class VocabularyError(ConfigError):
    """The vocabulary file is missing or malformed. Names the term at fault."""


@dataclass(frozen=True)
class Term:
    definition: str
    status: str
    introduced_by: str | None = None
    """The Digest that proposed it, for a `proposé` term."""
    replaced_by: str | None = None
    """The term that replaces it, once retired."""


@dataclass(frozen=True)
class Kind:
    definition: str
    labels: dict[str, Term]
    qualifiers: dict[str, Term]


@dataclass(frozen=True)
class Relation:
    term: Term
    from_kinds: tuple[str, ...]
    to_kinds: tuple[str, ...]


@dataclass(frozen=True)
class Vocabulary:
    kinds: dict[str, Kind]
    relations: dict[str, Relation]


def load_vocabulary(path: Path = VOCABULARY_PATH) -> Vocabulary:
    """The vocabulary file, read and checked. Raises VocabularyError."""
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError) as error:
        raise VocabularyError(f"the vocabulary can't be read: {error}") from error
    except yaml.YAMLError as error:
        raise VocabularyError(f"{path} is not valid YAML: {error}") from error
    if not isinstance(data, dict) or set(data) != {"kinds", "relations"}:
        raise VocabularyError(f"{path} must hold `kinds:` and `relations:`, and only them")
    kinds_data, relations_data = data["kinds"], data["relations"]
    if not isinstance(kinds_data, dict) or not kinds_data:
        raise VocabularyError(f"{path}: `kinds:` must map each kind to its terms")
    if not isinstance(relations_data, dict):
        raise VocabularyError(f"{path}: `relations:` must map each relation to its terms")

    kinds = {}
    for name, entry in kinds_data.items():
        where = f"{path}: kinds.{name}"
        _check_name(name, where)
        if not isinstance(entry, dict) or set(entry) != {"définition", "labels", "qualifiers"}:
            raise VocabularyError(f"{where} must hold `définition`, `labels` and `qualifiers`")
        kinds[name] = Kind(
            definition=_definition(entry["définition"], where),
            labels=_terms(entry["labels"], f"{where}.labels"),
            qualifiers=_terms(entry["qualifiers"], f"{where}.qualifiers"),
        )

    relations = {}
    for name, entry in relations_data.items():
        where = f"{path}: relations.{name}"
        _check_name(name, where)
        if not isinstance(entry, dict):
            raise VocabularyError(f"{where} must be a mapping")
        ends = {key: entry.get(key) for key in ("from", "to")}
        for key, end in ends.items():
            if (
                not isinstance(end, list)
                or not end
                or not all(isinstance(kind, str) and kind in kinds for kind in end)
            ):
                raise VocabularyError(f"{where}.{key} must list kinds of `kinds:`")
        term = {key: value for key, value in entry.items() if key not in ends}
        relations[name] = Relation(_term(term, where), tuple(ends["from"]), tuple(ends["to"]))
    _check_replacements({name: r.term for name, r in relations.items()}, f"{path}: relations")
    return Vocabulary(kinds, relations)


def _terms(data: object, where: str) -> dict[str, Term]:
    if not isinstance(data, dict):
        raise VocabularyError(f"{where} must map each term to its definition and status")
    terms = {}
    for name, entry in data.items():
        _check_name(name, f"{where}.{name}")
        terms[name] = _term(entry, f"{where}.{name}")
    _check_replacements(terms, where)
    return terms


def _term(entry: object, where: str) -> Term:
    allowed = {"définition", "statut", "introduit_par", "remplacé_par"}
    if not isinstance(entry, dict) or not set(entry) <= allowed:
        raise VocabularyError(f"{where} holds only {', '.join(sorted(allowed))}")
    status = entry.get("statut")
    if status not in STATUSES:
        raise VocabularyError(f"{where}: statut must be {' or '.join(STATUSES)}")
    introduced_by = entry.get("introduit_par")
    if (status == "proposé") != (isinstance(introduced_by, str) and bool(introduced_by.strip())):
        raise VocabularyError(f"{where}: a proposé term, and only one, names its Digest")
    replaced_by = entry.get("remplacé_par")
    if "remplacé_par" in entry and not isinstance(replaced_by, str):
        raise VocabularyError(f"{where}: remplacé_par must name a term")
    return Term(_definition(entry.get("définition"), where), status, introduced_by, replaced_by)


def _definition(value: object, where: str) -> str:
    if not isinstance(value, str) or not value.strip() or "\n" in value.strip():
        raise VocabularyError(f"{where}: définition must be one line of text")
    return value.strip()


def _check_name(name: object, where: str) -> None:
    if not isinstance(name, str) or not TERM.fullmatch(name) or name != name.lower():
        raise VocabularyError(f"{where}: a term is lowercase words joined by -")


def _check_replacements(terms: dict[str, Term], where: str) -> None:
    for name, term in terms.items():
        if term.replaced_by is None:
            continue
        replacement = terms.get(term.replaced_by)
        if replacement is None or replacement.replaced_by is not None:
            raise VocabularyError(
                f"{where}.{name}: remplacé_par {term.replaced_by!r} is not a term in use beside it"
            )


def check_mentions(
    data: dict, raw: RawText, vocabulary: Vocabulary | None, hosts: Iterable[str] = ()
) -> list[str]:
    """What is wrong with a Digest frontmatter's `mentions` and `relations`, one line each;
    nothing when it has neither. `hosts` are the Source's, who may go unnamed in the Raw."""
    if "mentions" not in data and "relations" not in data:
        return []
    if vocabulary is None:
        return ["mentions and relations can't be checked without the vocabulary"]
    mentions, relations = data.get("mentions", []), data.get("relations", [])
    problems = []
    if not isinstance(mentions, list):
        problems.append("mentions must be a list")
        mentions = []
    if not isinstance(relations, list):
        problems.append("relations must be a list")
        relations = []

    title = str(data.get("title") or "")
    hosted = {bare_words(host) for host in hosts}
    kinds: dict[str, str] = {}  # a mention's name, to its kind when it has a known one
    seen: set[str] = set()
    for number, mention in enumerate(mentions, start=1):
        if not isinstance(mention, dict):
            problems.append(f"mention {number} must be a mapping")
            continue
        name = mention.get("name")
        if not isinstance(name, str) or not name.strip():
            problems.append(f"mention {number} needs a name")
            continue
        problems += [
            f"mention {name!r}: {p}"
            for p in _check_mention(mention, raw, title, vocabulary, bare_words(name) in hosted)
        ]
        if bare_words(name) in seen:
            problems.append(f"mention {name!r} is listed twice")
        seen.add(bare_words(name))
        if isinstance(mention.get("kind"), str) and mention["kind"] in vocabulary.kinds:
            kinds.setdefault(name, mention["kind"])

    listed: set[tuple] = set()
    for number, relation in enumerate(relations, start=1):
        problems += _check_relation(number, relation, mentions, kinds, vocabulary)
        if isinstance(relation, dict):
            triple = tuple(str(relation.get(key)) for key in RELATION_KEYS)
            if triple in listed:
                problems.append(f"relation {number} repeats an earlier one")
            listed.add(triple)
    return problems


def _check_mention(
    mention: dict, raw: RawText, title: str, vocabulary: Vocabulary, host: bool
) -> list[str]:
    problems = []
    unknown = [str(key) for key in mention if key not in MENTION_KEYS]
    if unknown:
        problems.append(f"unknown keys {', '.join(unknown)}")
    kind_name = mention.get("kind")
    kind = vocabulary.kinds.get(kind_name) if isinstance(kind_name, str) else None
    if kind is None:
        problems.append(f"kind {kind_name!r} is not one of {', '.join(vocabulary.kinds)}")
    for key in ("labels", "qualifiers"):
        terms = mention.get(key, [])
        if not isinstance(terms, list):
            problems.append(f"{key} must be a list")
        elif kind is not None:
            group = kind.labels if key == "labels" else kind.qualifiers
            what = key[:-1]
            problems += [
                problem
                for term in terms
                if (problem := _check_term(group, term, f"{what} of a {kind_name}"))
            ]
            if len(set(map(str, terms))) < len(terms):
                problems.append(f"a {what} is listed twice")
    heard_as = mention.get("heard_as")
    if "heard_as" in mention and not (isinstance(heard_as, str) and heard_as.strip()):
        problems.append("heard_as must be the name as the captions spell it")
    if "unsure" in mention and mention["unsure"] is not True:
        problems.append("unsure is true, or left out")
    spoken = heard_as if isinstance(heard_as, str) and heard_as.strip() else mention["name"]
    # The title is the video's, from YouTube's metadata: it names a guest the Raw may not. A
    # host leads every Publication of the Source, and may never say their own name; a spelling
    # the captions are said to give is still looked for.
    if host and "heard_as" not in mention:
        return problems
    if not raw.names(spoken) and f" {bare_words(spoken)} " not in f" {bare_words(title)} ":
        hint = "" if "heard_as" in mention else "; heard_as gives the captions' spelling"
        problems.append(f"{spoken!r} is in neither the Raw nor the title{hint}")
    return problems


def _check_relation(
    number: int, relation: object, mentions: list, kinds: dict[str, str], vocabulary: Vocabulary
) -> list[str]:
    if not isinstance(relation, dict):
        return [f"relation {number} must be a mapping"]
    if set(relation) != set(RELATION_KEYS):
        return [f"relation {number} holds from, relation and to, and only them"]
    name = relation["relation"]
    known = vocabulary.relations.get(name) if isinstance(name, str) else None
    if known is None:
        return [f"relation {number}: {name!r} is not in the vocabulary's relations"]
    problems = []
    if known.term.replaced_by is not None:
        problems.append(
            f"relation {number}: {name!r} is retired, replaced by {known.term.replaced_by!r}"
        )
    names = {
        mention["name"]
        for mention in mentions
        if isinstance(mention, dict) and isinstance(mention.get("name"), str)
    }
    for end, allowed in (("from", known.from_kinds), ("to", known.to_kinds)):
        target = relation[end]
        if not isinstance(target, str) or target not in names:
            problems.append(f"relation {number}: {end} {target!r} is not a mention of this Digest")
        elif target in kinds and kinds[target] not in allowed:
            problems.append(
                f"relation {number}: {name} goes {end} {' or '.join(allowed)}, "
                f"and {target!r} is a {kinds[target]}"
            )
    return problems


def _check_term(group: dict[str, Term], term: object, what: str) -> str | None:
    known = group.get(term) if isinstance(term, str) else None
    if known is None:
        return f"{term!r} is not a {what} in the vocabulary"
    if known.replaced_by is not None:
        return f"{term!r} is retired, replaced by {known.replaced_by!r}"
    return None


@dataclass(frozen=True)
class NewTerm:
    """A term a draft proposes, which the vocabulary lacks."""

    group: str
    """`labels`, `qualifiers` or `relations`."""
    name: str
    definition: str
    kind: str | None = None
    """The kind a label or a qualifier belongs to."""
    from_kinds: tuple[str, ...] = ()
    to_kinds: tuple[str, ...] = ()


def read_new_terms(data: object, vocabulary: Vocabulary) -> tuple[list[NewTerm], list[str]]:
    """The terms a draft's `new_terms` propose, those the vocabulary already has left out, and
    what is wrong with the others, one line each."""
    if data is None:
        return [], []
    if not isinstance(data, list):
        return [], ["new_terms must be a list"]
    terms: list[NewTerm] = []
    problems: list[str] = []
    for number, entry in enumerate(data, start=1):
        where = f"new term {number}"
        named = [key for key in GROUPS if isinstance(entry, dict) and key in entry]
        if len(named) != 1:
            problems.append(f"{where} names one label, qualifier or relation")
            continue
        key = named[0]
        name, definition = entry[key], entry.get("definition")
        allowed = {key, "definition", *(("from", "to") if key == "relation" else ("kind",))}
        if set(entry) != allowed:
            problems.append(f"{where} holds {', '.join(sorted(allowed))}, and only them")
            continue
        if not isinstance(name, str) or not TERM.fullmatch(name) or name != name.lower():
            problems.append(f"{where}: {name!r} is not lowercase words joined by -")
            continue
        if yaml.safe_load(name) != name:  # `yes`, `no`, `on`: YAML's booleans
            problems.append(f"{where}: {name!r} reads as {yaml.safe_load(name)!r} in YAML")
            continue
        if not isinstance(definition, str) or not definition.strip() or "\n" in definition.strip():
            problems.append(f"{where}: {name!r} needs a definition of one line")
            continue
        if key == "relation":
            ends = [entry["from"], entry["to"]]
            if not all(
                isinstance(end, list) and end and all(kind in vocabulary.kinds for kind in end)
                for end in ends
            ):
                problems.append(f"{where}: from and to list kinds of the vocabulary")
                continue
            known = vocabulary.relations[name].term if name in vocabulary.relations else None
            term = NewTerm(
                "relations", name, definition.strip(), None, tuple(ends[0]), tuple(ends[1])
            )
        else:
            kind = vocabulary.kinds.get(entry["kind"]) if isinstance(entry["kind"], str) else None
            if kind is None:
                problems.append(f"{where}: kind {entry['kind']!r} is not one of the vocabulary")
                continue
            group = kind.labels if key == "label" else kind.qualifiers
            known = group.get(name)
            term = NewTerm(GROUPS[key], name, definition.strip(), entry["kind"])
        if known is not None and known.replaced_by is not None:
            problems.append(f"{where}: {name!r} is retired, replaced by {known.replaced_by!r}")
        elif known is None and all(
            (t.group, t.kind, t.name) != (term.group, term.kind, name) for t in terms
        ):
            terms.append(term)
    return terms, problems


def with_terms(vocabulary: Vocabulary, terms: list[NewTerm], introduced_by: str) -> Vocabulary:
    """The vocabulary with the terms added, `proposé`."""
    kinds, relations = dict(vocabulary.kinds), dict(vocabulary.relations)
    for term in terms:
        proposed = Term(term.definition, "proposé", introduced_by)
        if term.group == "relations":
            relations[term.name] = Relation(proposed, term.from_kinds, term.to_kinds)
        else:
            kind = kinds[term.kind]
            group = {**getattr(kind, term.group), term.name: proposed}
            kinds[term.kind] = replace(kind, **{term.group: group})
    return Vocabulary(kinds, relations)


def add_terms(terms: list[NewTerm], introduced_by: str, path: Path = VOCABULARY_PATH) -> None:
    """Writes the terms into the vocabulary file, `proposé`, each at the end of its group, and
    leaves every other line as it was. Raises VocabularyError, the file unchanged, when the
    file has no place for one or wouldn't read back."""
    if not terms:
        return
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    for term in terms:
        definition = json.dumps(term.definition, ensure_ascii=False)
        if term.group == "relations":
            at = _block_line(lines, "relations", 0, 0, len(lines))
            entry = [
                f"  {term.name}:",
                f"    définition: {definition}",
                f"    from: [{', '.join(term.from_kinds)}]",
                f"    to: [{', '.join(term.to_kinds)}]",
                "    statut: proposé",
                f"    introduit_par: {introduced_by}",
            ]
            indent = 0
        else:
            kinds = _block_line(lines, "kinds", 0, 0, len(lines))
            kind = _block_line(lines, term.kind, 2, kinds + 1, _block_end(lines, kinds, 0))
            at = _block_line(lines, term.group, 4, kind + 1, _block_end(lines, kind, 2))
            entry = [
                f"      {term.name}: {{définition: {definition}, statut: proposé, "
                f"introduit_par: {introduced_by}}}"
            ]
            indent = 4
        end = _block_end(lines, at, indent)
        lines[end:end] = entry
    written = "\n".join(lines)
    staged = path.with_name(f".{path.name}.new")
    staged.write_text(written, encoding="utf-8")
    try:
        load_vocabulary(staged)
    except VocabularyError as error:
        staged.unlink()
        raise VocabularyError(f"the proposed terms would break the vocabulary: {error}") from error
    os.replace(staged, path)


def _block_line(lines: list[str], key: str, indent: int, start: int, end: int) -> int:
    """The line opening `key:` at this indent; an empty `key: {}` is opened for terms."""
    for number in range(start, end):
        line = lines[number].rstrip()
        if line == f"{' ' * indent}{key}:":
            return number
        if line == f"{' ' * indent}{key}: {{}}":
            lines[number] = f"{' ' * indent}{key}:"
            return number
    raise VocabularyError(f"the vocabulary has no `{key}:` to add a term to")


def _block_end(lines: list[str], start: int, indent: int) -> int:
    """The line after the last one of the block opened at `start`, blank lines left out."""
    end = start + 1
    while end < len(lines) and (
        not lines[end].strip() or len(lines[end]) - len(lines[end].lstrip()) > indent
    ):
        end += 1
    while end > start + 1 and not lines[end - 1].strip():
        end -= 1
    return end

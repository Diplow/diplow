"""The known names: how a mention is spelled, whatever the captions heard.

`noms.yaml`, beside the vocabulary in wikipol's `.vocabulaire/`, lists the people and the
organisations the Sources talk about, by kind: each one's canonical `name`, and the other ways it
has been written or heard (`aliases`: a surname alone, an acronym, a captions' misspelling).
`wikipol digest` gives the model those whose name or an alias the Publication says, so it writes
the canonical name and keeps the captions' spelling in `heard_as`.

`seed_names` drew the first list from the frozen vaults' `Individus/` and `Organisations/` notes;
Ulysse corrects it by hand and adds the names the Digests confirm.
"""

from __future__ import annotations

import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

import yaml

from wikipol.digest.format import flow_yaml
from wikipol.digest.mentions import VocabularyError
from wikipol.digest.raw_text import RawText, bare_words
from wikipol.legacy_index import split_frontmatter

# src/wikipol/digest/names.py -> parents: digest, wikipol, src, Scripts, 1-wikipol
NAMES_PATH = Path(__file__).resolve().parents[4] / ".vocabulaire" / "noms.yaml"

LEGACY_FOLDERS = {"Individus": "personne", "Organisations": "organisation"}
HEADER = """\
# Les noms connus des mentions d'un Digest, par kind : le nom canonique (`name`) et les autres
# façons dont on l'a écrit ou entendu (`aliases`). `wikipol digest` donne au modèle ceux que la
# Publication dit. Tiré des fiches Individus/ et Organisations/ des vaults figés, puis corrigé et
# complété à la main ; CLAUDE.md, à côté, dit comment.
"""


@dataclass(frozen=True)
class KnownName:
    name: str
    kind: str
    aliases: tuple[str, ...] = ()

    @property
    def forms(self) -> tuple[str, ...]:
        return (self.name, *self.aliases)


def load_names(path: Path = NAMES_PATH) -> list[KnownName]:
    """The known names, read and checked. Raises VocabularyError."""
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except (OSError, UnicodeDecodeError) as error:
        raise VocabularyError(f"the known names can't be read: {error}") from error
    except yaml.YAMLError as error:
        raise VocabularyError(f"{path} is not valid YAML: {error}") from error
    if not isinstance(data, dict):
        raise VocabularyError(f"{path} must map each kind to its names")
    names = []
    for kind, entries in data.items():
        if not isinstance(entries, list):
            raise VocabularyError(f"{path}: {kind} must list its names")
        for entry in entries:
            name = entry.get("name") if isinstance(entry, dict) else None
            aliases = entry.get("aliases", []) if isinstance(entry, dict) else None
            if (
                not isinstance(name, str)
                or not name.strip()
                or set(entry) - {"name", "aliases"}
                or not isinstance(aliases, list)
                or not all(isinstance(alias, str) and alias.strip() for alias in aliases)
            ):
                raise VocabularyError(f"{path}: {kind}: {entry!r} is not {{name, aliases}}")
            names.append(KnownName(name, str(kind), tuple(aliases)))
    return names


def names_said(names: Iterable[KnownName], raw: RawText, title: str) -> list[KnownName]:
    """The known names the Publication says, by a form of them, in its Raw or its title; case,
    accents and punctuation aside, as check-digest finds a mention."""
    spoken_title = f" {bare_words(title)} "
    return [
        known
        for known in names
        if any(
            raw.names(form) or (bare_words(form) and f" {bare_words(form)} " in spoken_title)
            for form in known.forms
        )
    ]


def seed_names(vaults: Iterable[Path], kept: Iterable[KnownName] = ()) -> list[KnownName]:
    """The known names of the frozen vaults' person and organisation notes, after the ones
    `kept`.

    A note's name is its heading, which keeps the accents its file name drops, or else an alias
    that only adds accents to it; its file name and other aliases become aliases, but for those
    that are the name with other accents. A note whose name is already a form of a name is left
    out, so a hand correction survives a new seed. Two notes that only share an alias are two
    names: `AOC` is Alexandria Ocasio-Cortez and Amélie Oudéa-Castéra."""
    names = list(kept)
    known = {bare_words(form) for name in names for form in name.forms}
    for vault in vaults:
        for folder, kind in LEGACY_FOLDERS.items():
            for path in sorted((vault / folder).glob("*.md")):
                seeded = None if path.name == "CLAUDE.md" else _note_name(path, kind)
                if seeded and bare_words(seeded.name) not in known:
                    names.append(seeded)
                    known |= {bare_words(form) for form in seeded.forms}
    return names


def _note_name(path: Path, kind: str) -> KnownName | None:
    frontmatter, body = split_frontmatter(path.read_text(encoding="utf-8"))
    heading = next((line[2:].strip() for line in body.splitlines() if line.startswith("# ")), "")
    aliases = frontmatter.get("aliases") or []
    aliases = [str(a).strip() for a in (aliases if isinstance(aliases, list) else [aliases])]
    name = heading or path.stem
    accented = [a for a in aliases if bare_words(a) == bare_words(name) and _accents(a)]
    if not _accents(name) and accented:
        name = accented[0]
    if not bare_words(name):
        return None
    others: list[str] = []
    for form in [path.stem, heading, *aliases]:
        if bare_words(form) and bare_words(form) not in {bare_words(o) for o in [name, *others]}:
            others.append(form)
    return KnownName(name, kind, tuple(others))


def _accents(text: str) -> bool:
    return any(unicodedata.combining(char) for char in unicodedata.normalize("NFKD", text))


def render_names(names: Iterable[KnownName]) -> str:
    """The `noms.yaml` file: by kind, people first, then by name."""
    by_kind: dict[str, list[KnownName]] = {}
    for known in names:
        by_kind.setdefault(known.kind, []).append(known)
    order = [*LEGACY_FOLDERS.values(), *sorted(set(by_kind) - set(LEGACY_FOLDERS.values()))]
    lines = [HEADER]
    for kind in (kind for kind in order if kind in by_kind):
        lines.append(f"{kind}:")
        for known in sorted(by_kind[kind], key=lambda k: bare_words(k.name)):
            entry = {
                "name": known.name,
                **({"aliases": list(known.aliases)} if known.aliases else {}),
            }
            lines.append(f"  - {flow_yaml(entry)}")
        lines.append("")
    return "\n".join(lines)


def check_known_names(mentions: object, names: Iterable[KnownName]) -> list[str]:
    """The mentions named by a form the known names list as another name's alias, one line
    each: the list holds the canonical name, and the captions' spelling goes in `heard_as`. An
    alias two known names share says nothing."""
    if not isinstance(mentions, list):
        return []
    names = list(names)
    canonical = {bare_words(known.name) for known in names}
    by_alias: dict[str, set[str]] = {}
    for known in names:
        for alias in known.aliases:
            by_alias.setdefault(bare_words(alias), set()).add(known.name)
    problems = []
    for mention in mentions:
        name = mention.get("name") if isinstance(mention, dict) else None
        if not isinstance(name, str) or bare_words(name) in canonical:
            continue
        known = by_alias.get(bare_words(name), set())
        if len(known) == 1:
            problems.append(
                f"mention {name!r}: the known names write it {next(iter(known))!r}; "
                "the captions' spelling goes in heard_as"
            )
    return problems

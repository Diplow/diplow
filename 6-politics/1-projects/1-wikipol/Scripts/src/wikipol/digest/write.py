"""`wikipol digest`: one Raw in, one checked Digest out, written by the Source's pinned model.

The Python side does what must not vary: it reads the Raw, the Source's editorial `CLAUDE.md` and
the frozen vault's note on the Publication, the vocabulary and the known names the Publication
says, fills the Digest's fields, and checks the result. The `write-digest` skill, run by
`claude -p --model <the id pinned in source.yaml>`, writes what only a reader can: the Preview,
the mentions and the claims with their Extracts. A draft that fails the check goes back once,
with what was wrong; a second failure keeps nothing. The terms an accepted draft proposes join
the vocabulary, `proposé`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path

from wikipol.claude import Writer, read_draft, retry_prompt
from wikipol.config import REPO_ROOT, Source, pinned_model
from wikipol.digest.format import (
    DigestFields,
    check_digest,
    render,
    split_digest,
)
from wikipol.digest.mentions import (
    VOCABULARY_PATH,
    add_terms,
    load_vocabulary,
    read_new_terms,
    with_terms,
)
from wikipol.digest.names import NAMES_PATH, KnownName, load_names, names_said
from wikipol.digest.raw_text import clock, parse_raw
from wikipol.legacy_index import LegacyNote, find_video_note
from wikipol.raw_store import Raw, RawStore

# src/wikipol/digest/write.py -> parents: digest, wikipol, src, Scripts, 1-wikipol
SKILL_PATH = Path(__file__).resolve().parents[4] / "Skills" / "write-digest" / "SKILL.md"
ATTEMPTS = 2


class DigestRejected(Exception):
    """Every draft failed the check. Holds the last one and what was wrong with it."""

    def __init__(self, problems: list[str], draft: str) -> None:
        super().__init__(f"{len(problems)} problems left after {ATTEMPTS} drafts")
        self.problems, self.draft = problems, draft


@dataclass(frozen=True)
class Digest:
    fields: DigestFields
    text: str
    drafts: int


def linkable_digests(source: Source, repo_root: Path = REPO_ROOT) -> dict[str, str]:
    """The Source's Digests a new one may cite: repo path without `.md` -> title. Nothing for a
    Source outside the repo, whose Digests have no repo path to link."""
    found: dict[str, str] = {}
    if not source.chronicle.resolve().is_relative_to(repo_root.resolve()):
        return found
    for path in sorted(source.chronicle.resolve().rglob("*.md")):
        if path.name == "CLAUDE.md":
            continue
        frontmatter, _ = split_digest(path.read_text(encoding="utf-8"))
        if frontmatter and "digest_version" in frontmatter:
            target = path.relative_to(repo_root.resolve()).with_suffix("").as_posix()
            found[target] = str(frontmatter.get("title") or "")
    return found


def build_prompt(
    source: Source,
    fields: DigestFields,
    raw_body: str,
    timed: bool,
    legacy_note: str | None,
    linkable: dict[str, str],
    vocabulary: str = "",
    known: list[KnownName] | None = None,
) -> str:
    editorial = source.node / "CLAUDE.md"
    duration = f"{fields.duration} s ({clock(fields.duration)})" if fields.duration else "inconnue"
    stamps = (
        f"blocs horodatés ; lien d'un Extract : {fields.url}&t=<secondes>s"
        if timed
        else "aucun : les Extracts n'ont pas de lien, `> « citation »`"
    )
    sections = [
        "# La Publication",
        "",
        f"- Source : {source.name} (attribution : {source.attribution or source.name})",
        f"- Titre : {fields.title}",
        f"- youtube_id : {fields.youtube_id}",
        f"- Publiée le : {fields.published.isoformat() if fields.published else 'inconnue'}",
        f"- Durée : {duration}",
        f"- Horodatage du Raw : {stamps}",
        "",
        "# Contexte éditorial de la Source (son CLAUDE.md)",
        "",
        editorial.read_text(encoding="utf-8") if editorial.is_file() else "Aucun.",
        "",
        "# Fiche legacy (entrée complémentaire : ne rien en recopier)",
        "",
        legacy_note or "Aucune fiche legacy pour cette Publication.",
        "",
        "# Digests de la Source que tu peux lier",
        "",
        "\n".join(f"- [[{path}|{title}]]" for path, title in linkable.items())
        or "Aucun pour l'instant : n'écris aucun wikilink.",
        "",
        "# Les animateurs de la Source",
        "",
        "\n".join(f"- {host}" for host in source.hosts)
        or "Aucun déclaré : une personne n'est mentionnée que si le Raw ou le titre la nomme.",
        "",
        "# Le vocabulaire des mentions (.vocabulaire/vocabulaire.yaml)",
        "",
        vocabulary or "Aucun.",
        "",
        "# Les noms connus que la Publication dit (nom canonique, puis les formes déjà vues)",
        "",
        "\n".join(
            f"- {name.name} ({name.kind}"
            + (f" ; aussi : {', '.join(name.aliases)}" if name.aliases else "")
            + ")"
            for name in known or []
        )
        or "Aucun.",
        "",
        "# Le Raw",
        "",
        raw_body,
    ]
    return "\n".join(sections)


def digest_fields(
    source: Source, raw: Raw, note: LegacyNote | None, parent: str, ingested: date, model: str
) -> DigestFields:
    """What the pipeline knows of a Digest from its Raw and its legacy note: the title and the
    duration from the Raw's metadata, the date from it or else from the note."""
    return DigestFields(
        title=raw.meta.title or raw.youtube_id,
        parent=parent,
        source=source.slug,
        youtube_id=raw.youtube_id,
        published=raw.meta.published or (note.published if note else None),
        duration=raw.meta.duration,
        ingested=ingested,
        model=model,
    )


def write_digest(
    source: Source,
    youtube_id: str,
    store: RawStore,
    writer: Writer,
    parent: str,
    today: date,
    linkable: dict[str, str] | None = None,
    skill_path: Path = SKILL_PATH,
    vocabulary_path: Path = VOCABULARY_PATH,
    names_path: Path = NAMES_PATH,
) -> Digest:
    """The Digest of one Publication, checked; the terms it proposes are written into the
    vocabulary. Raises DigestRejected, WriterFailed, ConfigError (VocabularyError included),
    RawNotFound."""
    model = pinned_model(source)
    raw = store.get(source.slug, youtube_id)
    raw_body = raw.body.decode("utf-8")
    raw_text = parse_raw(raw_body)
    note = find_video_note(source.legacy_vault, youtube_id)
    fields = digest_fields(source, raw, note, parent=parent, ingested=today, model=model)
    linkable = {} if linkable is None else linkable
    skill = skill_path.read_text(encoding="utf-8")
    vocabulary = load_vocabulary(vocabulary_path)
    prompt = build_prompt(
        source,
        fields,
        raw_body,
        raw_text.timed,
        note.text if note else None,
        linkable,
        vocabulary=vocabulary_path.read_text(encoding="utf-8"),
        known=names_said(load_names(names_path), raw_text, fields.title),
    )
    asked = prompt
    for attempt in range(1, ATTEMPTS + 1):
        draft = writer(skill, asked, model)
        frontmatter, claims = read_draft(draft)
        preview = " ".join(str(frontmatter.get("preview") or "").split())
        mentions, relations = frontmatter.get("mentions"), frontmatter.get("relations")
        text = render(fields, preview, claims, mentions, relations)
        terms, problems = read_new_terms(frontmatter.get("new_terms"), vocabulary)
        if not frontmatter:  # a preview is always wanted: no frontmatter is one YAML can't read
            problems.append(
                "the draft's frontmatter is not YAML that reads: quote a value holding a colon, "
                "a comma, a # or brackets"
            )
        problems += check_digest(
            text,
            raw_text,
            expected=fields,
            linkable=set(linkable),
            vocabulary=with_terms(vocabulary, terms, fields.raw),
            hosts=source.hosts,
        )
        if not problems:
            add_terms(terms, introduced_by=fields.raw, path=vocabulary_path)
            return Digest(fields, text, attempt)
        asked = retry_prompt(prompt, draft, problems)
    raise DigestRejected(problems, text)

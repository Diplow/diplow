"""`wikipol digest`: one Raw in, one checked Digest out, written by the Source's pinned model.

The Python side does what must not vary: it reads the Raw, the Source's editorial `CLAUDE.md` and
the frozen vault's note on the Publication, fills the Digest's fields, and checks the result. The
`write-digest` skill, run by `claude -p --model <the id pinned in source.yaml>`, writes what only
a reader can: the Preview and the claims with their Extracts. A draft that fails the check goes
back once, with what was wrong; a second failure keeps nothing.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Protocol

from wikipol.config import REPO_ROOT, Source, pinned_model
from wikipol.digest.format import (
    DigestFields,
    check_digest,
    render,
    split_digest,
)
from wikipol.digest.raw_text import clock, parse_raw
from wikipol.legacy_index import find_video_note
from wikipol.raw_store import RawStore

# src/wikipol/digest/write.py -> parents: digest, wikipol, src, Scripts, 1-wikipol
SKILL_PATH = Path(__file__).resolve().parents[4] / "Skills" / "write-digest" / "SKILL.md"
ATTEMPTS = 2
CLAUDE_TIMEOUT_SECONDS = 20 * 60

Run = Callable[[Sequence[str], str, Path, int], "subprocess.CompletedProcess[str]"]
"""Runs a command with its stdin, working folder and timeout in seconds, capturing text."""


class WriterFailed(Exception):
    """`claude -p` gave no draft: it failed, timed out, or answered with another model."""


class DigestRejected(Exception):
    """Every draft failed the check. Holds the last one and what was wrong with it."""

    def __init__(self, problems: list[str], draft: str) -> None:
        super().__init__(f"{len(problems)} problems left after {ATTEMPTS} drafts")
        self.problems, self.draft = problems, draft


class Writer(Protocol):
    def __call__(self, skill: str, prompt: str, model: str) -> str:
        """The draft `model` writes, following `skill`, from `prompt`."""
        ...


def run_command(
    command: Sequence[str], stdin: str, cwd: Path, timeout: int
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command, input=stdin, cwd=cwd, capture_output=True, text=True, timeout=timeout, check=False
    )


class ClaudeCli:
    """`claude -p` on the subscription: the skill as its system prompt, no tool, no MCP server,
    no session kept, run from an empty folder so no project's CLAUDE.md or hook joins in."""

    def __init__(self, run: Run = run_command, executable: str = "claude") -> None:
        self.run, self.executable = run, executable

    def __call__(self, skill: str, prompt: str, model: str) -> str:
        command = [
            self.executable,
            "-p",
            "--model",
            model,
            "--system-prompt",
            skill,
            "--tools",
            "",
            "--strict-mcp-config",
            "--disable-slash-commands",
            "--no-session-persistence",
            "--output-format",
            "json",
        ]
        with tempfile.TemporaryDirectory(prefix="wikipol-digest-") as folder:
            try:
                result = self.run(command, prompt, Path(folder), CLAUDE_TIMEOUT_SECONDS)
            except subprocess.TimeoutExpired as error:
                raise WriterFailed(f"claude timed out after {CLAUDE_TIMEOUT_SECONDS} s") from error
        try:
            answer = json.loads(result.stdout)
        except json.JSONDecodeError as error:
            raise WriterFailed(
                f"claude exited with {result.returncode}, no JSON answer: "
                f"{(result.stderr or result.stdout).strip()[-300:]}"
            ) from error
        if result.returncode != 0 or answer.get("is_error") or "result" not in answer:
            raise WriterFailed(f"claude failed: {str(answer.get('result', ''))[:300]}")
        used = set(answer.get("modelUsage") or {})
        if used and not any(name == model or name.startswith(f"{model}[") for name in used):
            raise WriterFailed(f"claude answered with {', '.join(sorted(used))}, not {model}")
        return str(answer["result"])


@dataclass(frozen=True)
class Digest:
    fields: DigestFields
    text: str
    drafts: int


def linkable_digests(source: Source, repo_root: Path = REPO_ROOT) -> dict[str, str]:
    """The Source's Digests a new one may cite: repo path without `.md` -> title. None for a
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
        "# Le Raw",
        "",
        raw_body,
    ]
    return "\n".join(sections)


def retry_prompt(prompt: str, draft: str, problems: list[str]) -> str:
    listed = "\n".join(f"- {problem}" for problem in problems)
    return (
        f"{prompt}\n\n# Ta version précédente, refusée par le validateur\n\n"
        f"Le validateur a relevé :\n\n{listed}\n\nTa version :\n\n{draft}\n\n"
        "Réécris le document entier en corrigeant chacun de ces points."
    )


def split_draft(draft: str) -> tuple[str, str]:
    """The Preview and the claims of a draft; a code fence or a title heading around them goes."""
    text = draft.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.rsplit("```", 1)[0].strip()
    frontmatter, body = split_digest(text + "\n")
    preview = str((frontmatter or {}).get("preview") or "")
    body = body.strip()
    if body.startswith("# "):
        body = body.split("\n", 1)[1] if "\n" in body else ""
    return " ".join(preview.split()), body.strip()


def write_digest(
    source: Source,
    youtube_id: str,
    store: RawStore,
    writer: Writer,
    parent: str,
    today: date,
    linkable: dict[str, str] | None = None,
    skill_path: Path = SKILL_PATH,
) -> Digest:
    """The Digest of one Publication, checked. Raises DigestRejected, WriterFailed, ConfigError,
    RawNotFound."""
    model = pinned_model(source)
    raw = store.get(source.slug, youtube_id)
    raw_body = raw.body.decode("utf-8")
    raw_text = parse_raw(raw_body)
    note = find_video_note(source.legacy_vault, youtube_id)
    fields = DigestFields(
        title=raw.meta.title or youtube_id,
        parent=parent,
        source=source.slug,
        youtube_id=youtube_id,
        published=raw.meta.published or (note.published if note else None),
        duration=raw.meta.duration,
        ingested=today,
        model=model,
    )
    linkable = {} if linkable is None else linkable
    skill = skill_path.read_text(encoding="utf-8")
    prompt = build_prompt(
        source, fields, raw_body, raw_text.timed, note.text if note else None, linkable
    )
    asked = prompt
    for attempt in range(1, ATTEMPTS + 1):
        draft = writer(skill, asked, model)
        text = render(fields, *split_draft(draft))
        problems = check_digest(text, raw_text, expected=fields, linkable=set(linkable))
        if not problems:
            return Digest(fields, text, attempt)
        asked = retry_prompt(prompt, draft, problems)
    raise DigestRejected(problems, text)

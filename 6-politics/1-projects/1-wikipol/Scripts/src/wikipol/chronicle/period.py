"""A Period's file, its `CLAUDE.md`, and the `write-period` skill that writes its summary.

The file is the repo's four fields, the title (the date range) as a heading, the summary the
skill wrote, then `## Contenu`, the list of its children with a wikilink each, which Python
writes. The skill writes only the Preview and the summary, from the children's titles and
Previews, through `claude -p` on the model pinned in the Source's `source.yaml`. A draft that
fails the check goes back once with what was wrong; a second failure keeps nothing.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from wikipol.chronicle.tree import Leaf, Period, Summary, date_range
from wikipol.claude import Writer, retry_prompt, split_draft
from wikipol.config import Source, pinned_model
from wikipol.digest.format import (
    OWNER,
    PREVIEW_MAX_CHARS,
    PROSE_QUOTE,
    folded_preview,
    split_digest,
)
from wikipol.digest.raw_text import words

# src/wikipol/chronicle/period.py -> parents: chronicle, wikipol, src, Scripts, 1-wikipol
SKILL_PATH = Path(__file__).resolve().parents[4] / "Skills" / "write-period" / "SKILL.md"
ATTEMPTS = 2
CONTENTS = "## Contenu"
MAX_PARAGRAPHS = 3
LIST_ITEM = re.compile(r"\s*(?:[-*+]|\d+[.)])\s")
# `[[target]]`, `[[target.md]]`, `[[target|label]]`, `[[target#heading]]`, `![[...]]`, and
# `[[target\|label]]`, the pipe escaped inside a Markdown table.
LINK = re.compile(r"\[\[([^\]|#]+?)(\.md)?(\\?[#|][^\]]*)?\]\]")


class PeriodRejected(Exception):
    """Every draft of a Period's summary failed the check."""

    def __init__(self, title: str, problems: list[str], draft: str) -> None:
        super().__init__(f"the summary of {title}: {len(problems)} problems after {ATTEMPTS}")
        self.problems, self.draft = problems, draft


def link(child: Period | Leaf) -> str:
    """What a wikilink to the child names: a Digest's path, a Period's `CLAUDE` file."""
    return str(child.path) if isinstance(child, Leaf) else f"{child.path}/CLAUDE"


def label(text: str) -> str:
    """Text safe inside a wikilink's label, where `|` and brackets would end it early."""
    return text.replace("|", "-").replace("[", "(").replace("]", ")")


def contents_line(number: int, child: Period | Leaf) -> str:
    if isinstance(child, Leaf):
        return f"{number}. [[{link(child)}|{label(child.title)}]] ({child.published.isoformat()})"
    count = len(child.leaves())
    return f"{number}. [[{link(child)}|{child.title}]] ({count} Digest{'s' if count > 1 else ''})"


def render_period(period: Period) -> str:
    """The Period's `CLAUDE.md`, from its summary and its children as the tree holds them."""
    if period.summary is None:
        raise ValueError(f"{period.path} has no summary to write")
    frontmatter = [
        f"title: {json.dumps(period.title, ensure_ascii=False)}",
        f"parent: {period.path}",
        f"owner: {OWNER}",
        *folded_preview(period.summary.preview),
    ]
    contents = [contents_line(n, child) for n, child in enumerate(period.children, start=1)]
    return "\n".join(
        [
            "---",
            *frontmatter,
            "---",
            f"# {period.title}",
            "",
            period.summary.body.strip(),
            "",
            CONTENTS,
            "",
            *contents,
            "",
        ]
    )


def read_period(text: str) -> tuple[str | None, Summary]:
    """A Period file's title and summary: the Preview, and the Body between the title and
    `## Contenu` (all of it when the file has no such list, as a Chronicle written by hand)."""
    frontmatter, body = split_digest(text)
    frontmatter = frontmatter or {}
    lines = body.strip("\n").split("\n")
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
    if CONTENTS in lines:
        lines = lines[: lines.index(CONTENTS)]
    title = frontmatter.get("title")
    preview = " ".join(str(frontmatter.get("preview") or "").split())
    return (str(title) if title else None), Summary(preview, "\n".join(lines).strip())


def check_summary(preview: str, body: str, period: Period) -> list[str]:
    """What is wrong with a summary of `period`, one line each; nothing when it holds."""
    problems = []
    if not preview:
        problems.append("preview is empty")
    elif len(preview) > PREVIEW_MAX_CHARS:
        problems.append(f"preview is {len(preview)} characters, {PREVIEW_MAX_CHARS} at most")
    if not body.strip():
        problems.append("the body is empty: one to three paragraphs wanted")
    paragraphs = [part for part in re.split(r"\n\s*\n", body.strip()) if part.strip()]
    if len(paragraphs) > MAX_PARAGRAPHS:
        problems.append(f"the body has {len(paragraphs)} paragraphs, {MAX_PARAGRAPHS} at most")
    for number, line in enumerate(body.split("\n"), start=1):
        if line.startswith("#"):
            problems.append(f"body line {number}: no heading, the contents list is added after")
        elif line.startswith(">"):
            problems.append(f"body line {number}: no Extract, they stay in the Digests")
        elif LIST_ITEM.match(line):
            problems.append(f"body line {number}: no list, paragraphs only")
    children = {link(child) for child in period.children}
    for match in LINK.finditer(body):
        if match.group(1).strip() not in children:
            problems.append(f"{match.group(0)} links something other than the Period's children")
    # Words in guillemets quote the Source; a Period knows it only through its children.
    known = f" {words(' '.join(text for child in period.children for text in heard(child)))} "
    for quote in PROSE_QUOTE.findall(f"{preview}\n{body}"):
        if f" {words(quote)} " not in known or not words(quote):
            problems.append(f"« {quote} » is quoted, and no child's title or Preview says it")
    return problems


def heard(child: Period | Leaf) -> tuple[str, str]:
    """A child's title and Preview: all a Period's summary may quote."""
    if isinstance(child, Leaf):
        return child.title, child.preview
    return child.title, child.summary.preview if child.summary else ""


def build_prompt(source: Source, period: Period, chronicle: bool) -> str:
    editorial = source.node / "CLAUDE.md"
    leaves = period.leaves()
    span = date_range(period.start, period.end)
    what = (
        f"la Chronicle entière de {source.name}, {span}"
        if chronicle
        else f"la Period {period.title}"
    )
    kind = "des Digests" if period.holds_digests else "des Periods plus courtes"
    sections = [
        "# La Period",
        "",
        f"- Source : {source.name} (attribution : {source.attribution or source.name})",
        f"- Tu résumes : {what}",
        f"- Elle couvre {len(leaves)} Digest{'s' if len(leaves) > 1 else ''}, du "
        f"{period.start.isoformat()} au {period.end.isoformat()}",
        f"- Ses enfants sont {kind}, dans l'ordre chronologique",
        "",
        "# Contexte éditorial de la Source (son CLAUDE.md)",
        "",
        editorial.read_text(encoding="utf-8") if editorial.is_file() else "Aucun.",
        "",
        "# Ses enfants",
        "",
    ]
    for number, child in enumerate(period.children, start=1):
        title, preview = heard(child)
        when = (
            child.published.isoformat()
            if isinstance(child, Leaf)
            else f"{len(child.leaves())} Digests"
        )
        sections += [f"## {number}. [[{link(child)}|{label(title)}]] ({when})", "", preview, ""]
    return "\n".join(sections)


def write_period(
    source: Source,
    period: Period,
    writer: Writer,
    chronicle: bool = False,
    skill_path: Path = SKILL_PATH,
) -> Summary:
    """The summary of one Period, checked; `chronicle` when it is the Chronicle itself. Its
    children must have their path and, for Periods, their summary. Raises PeriodRejected,
    WriterFailed, ConfigError."""
    model = pinned_model(source)
    skill = skill_path.read_text(encoding="utf-8")
    prompt = build_prompt(source, period, chronicle)
    asked = prompt
    for _ in range(ATTEMPTS):
        draft = writer(skill, asked, model)
        preview, body = split_draft(draft)
        problems = check_summary(preview, body, period)
        if not problems:
            return Summary(preview, body)
        asked = retry_prompt(prompt, draft, problems)
    raise PeriodRejected(period.title, problems, draft)

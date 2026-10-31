"""The Digest file: how the pipeline writes one, and what it checks before keeping it.

A Digest is a Markdown file, in French. Its frontmatter holds the repo's four fields (`title`,
`parent`, `owner`, `preview`) and the Digest's own (`DIGEST_FIELDS`). Its Body is the video's
title as a heading, then up to six claims, `## <n>. <claim>`, each backed by one to three
Extracts, one per line:

    > [12:30](https://www.youtube.com/watch?v=<id>&t=750s) « the words, as the Raw has them »

An Extract of a Raw without timestamps has no link: `> « ... »`. BUILD.md shows the whole file.
"""

from __future__ import annotations

import json
import re
import textwrap
from dataclasses import dataclass
from datetime import date

import yaml

from wikipol.config import is_pinned_model
from wikipol.digest.raw_text import RawText, clock_seconds, words
from wikipol.raw_store import YOUTUBE_ID, raw_key

DIGEST_VERSION = 1
"""Bumped when the format or the write-digest skill changes what a Digest says."""

OWNER = "diplo"
PREVIEW_MAX_CHARS = 350
MAX_CLAIMS = 6
MAX_EXTRACTS = 3
MIN_QUOTE_WORDS = 5

REPO_FIELDS = ("title", "parent", "owner", "preview")
DIGEST_FIELDS = (
    "source",
    "url",
    "youtube_id",
    "published",
    "duration",
    "raw",
    "ingested",
    "digest_version",
    "model",
)

CLAIM = re.compile(r"^## (\d+)\. (\S.*)$")
TIMED_EXTRACT = re.compile(
    r"^> \[(?P<label>[0-9:]+)\]\(https://www\.youtube\.com/watch\?v=(?P<id>[A-Za-z0-9_-]{11})"
    r"&t=(?P<seconds>\d+)s\) « (?P<quote>.+) »$"
)
UNTIMED_EXTRACT = re.compile(r"^> « (?P<quote>.+) »$")
WIKILINK = re.compile(r"\[\[([^\]|#]+)")
PROSE_QUOTE = re.compile(r"«\s*([^«»]+?)\s*»")


def watch_url(youtube_id: str, seconds: int | None = None) -> str:
    url = f"https://www.youtube.com/watch?v={youtube_id}"
    return url if seconds is None else f"{url}&t={seconds}s"


@dataclass(frozen=True)
class DigestFields:
    """What the pipeline knows about a Digest before anyone writes it."""

    title: str
    parent: str
    source: str
    youtube_id: str
    published: date | None
    duration: int | None
    ingested: date
    model: str

    @property
    def url(self) -> str:
        return watch_url(self.youtube_id)

    @property
    def raw(self) -> str:
        return raw_key(self.source, self.youtube_id)


def render(fields: DigestFields, preview: str, claims: str) -> str:
    """The Digest file: the frontmatter, the title as a heading, then the claims as written."""
    # Folded YAML joins lines with a space: a break after `peut-` would read back `peut- être`.
    preview_lines = textwrap.wrap(
        " ".join(preview.split()), width=76, break_on_hyphens=False, break_long_words=False
    ) or [""]
    frontmatter = [
        f"title: {json.dumps(fields.title, ensure_ascii=False)}",
        f"parent: {fields.parent}",
        f"owner: {OWNER}",
        "preview: >-",
        *(f"  {line}" for line in preview_lines),
        f"source: {fields.source}",
        f"url: {fields.url}",
        f"youtube_id: {json.dumps(fields.youtube_id)}",
        f"published: {fields.published.isoformat() if fields.published else 'null'}",
        f"duration: {'null' if fields.duration is None else fields.duration}",
        f"raw: {fields.raw}",
        f"ingested: {fields.ingested.isoformat()}",
        f"digest_version: {DIGEST_VERSION}",
        f"model: {fields.model}",
    ]
    return "\n".join(["---", *frontmatter, "---", f"# {fields.title}", "", claims.strip(), ""])


def split_digest(text: str) -> tuple[dict | None, str]:
    """The frontmatter as YAML reads it (None when there is none or it doesn't parse), and the
    rest of the file."""
    if not text.startswith("---\n"):
        return None, text
    end = text.find("\n---\n", 3)
    if end == -1:
        return None, text
    try:
        data = yaml.safe_load(text[4:end])
    except (yaml.YAMLError, ValueError):  # ValueError: a date YAML reads but can't build
        return None, text[end + 5 :]
    return (data if isinstance(data, dict) else None), text[end + 5 :]


def check_digest(
    text: str,
    raw: RawText,
    expected: DigestFields | None = None,
    linkable: set[str] = frozenset(),
) -> list[str]:
    """What is wrong with a Digest, one line each; nothing when it holds.

    `raw` is its Publication's Raw, `expected` what the pipeline knows of its fields, and
    `linkable` the Digests it may cite, as repo paths without `.md`.
    """
    frontmatter, body = split_digest(text)
    if frontmatter is None:
        return ["no readable YAML frontmatter"]
    problems = _check_fields(frontmatter, expected)
    youtube_id = str(frontmatter.get("youtube_id") or "")
    duration = frontmatter.get("duration")
    duration = duration if isinstance(duration, int) and not isinstance(duration, bool) else None
    problems += _check_body(body, str(frontmatter.get("title") or ""), youtube_id, duration, raw)
    for target in WIKILINK.findall(body):
        if target.strip() not in linkable:
            problems.append(f"wikilink to [[{target}]], which is not a Digest it may cite")
    # Words in guillemets outside an Extract quote the Source too, and must be in the Raw; the
    # title is the video's, not a quote. The prose is read as one text, so a quote a line break
    # cuts is still read whole; a stray « pairs with a later » and fails, never passes.
    lines = [line for line in body.split("\n") if not line.startswith((">", "# "))]
    for text in (str(frontmatter.get("preview") or ""), " ".join(lines)):
        for quote in PROSE_QUOTE.findall(text):
            if not raw.holds(quote):
                problems.append(f"« {quote} » is quoted outside an Extract and is not in the Raw")
    return problems


def _check_fields(data: dict, expected: DigestFields | None) -> list[str]:
    problems = []
    missing = [name for name in (*REPO_FIELDS, *DIGEST_FIELDS) if name not in data]
    extra = [name for name in data if name not in (*REPO_FIELDS, *DIGEST_FIELDS)]
    if missing:
        problems.append(f"frontmatter lacks {', '.join(missing)}")
    if extra:
        problems.append(f"frontmatter has unknown fields {', '.join(map(str, extra))}")
    for name in ("title", "parent", "owner", "source", "model"):
        if name in data and not (isinstance(data[name], str) and data[name].strip()):
            problems.append(f"{name} must be a non-empty string")
    if "owner" in data and data["owner"] != OWNER:
        problems.append(f"owner must be {OWNER}")

    preview = data.get("preview")
    if not isinstance(preview, str) or not preview.strip():
        problems.append("preview is empty")
    elif len(" ".join(preview.split())) > PREVIEW_MAX_CHARS:
        length = len(" ".join(preview.split()))
        problems.append(f"preview is {length} characters, {PREVIEW_MAX_CHARS} at most")

    youtube_id, source = str(data.get("youtube_id") or ""), str(data.get("source") or "")
    if not YOUTUBE_ID.fullmatch(youtube_id):
        problems.append(f"youtube_id {youtube_id!r} is not a YouTube id")
    else:
        if data.get("url") != watch_url(youtube_id):
            problems.append(f"url must be {watch_url(youtube_id)}")
        try:
            if data.get("raw") != raw_key(source, youtube_id):
                problems.append(f"raw must be {raw_key(source, youtube_id)}")
        except ValueError:
            problems.append(f"source {source!r} is not a Source slug")
    if data.get("published") is not None and not isinstance(data.get("published"), date):
        problems.append("published must be a date (YYYY-MM-DD) or null")
    duration = data.get("duration")
    if duration is not None and (
        not isinstance(duration, int) or isinstance(duration, bool) or duration <= 0
    ):
        problems.append("duration must be a number of seconds or null")
    if not isinstance(data.get("ingested"), date):
        problems.append("ingested must be a date (YYYY-MM-DD)")
    version = data.get("digest_version")
    if not isinstance(version, int) or isinstance(version, bool) or version < 1:
        problems.append("digest_version must be a positive integer")
    model = data.get("model")
    if isinstance(model, str) and model.strip() and not is_pinned_model(model):
        problems.append(f"model {model!r} is an alias, not a pinned model id")

    if expected is not None:
        wanted = {
            "title": expected.title,
            "parent": expected.parent,
            "source": expected.source,
            "youtube_id": expected.youtube_id,
            "published": expected.published,
            "duration": expected.duration,
            "model": expected.model,
        }
        for name, value in wanted.items():
            if name in data and data[name] != value:
                problems.append(f"{name} is {data[name]!r}, expected {value!r}")
    return problems


def _check_body(
    body: str, title: str, youtube_id: str, duration: int | None, raw: RawText
) -> list[str]:
    problems = []
    lines = body.strip("\n").split("\n")
    first = 1  # body lines are numbered from the title's
    if lines[0] != f"# {title}":
        problems.append("the body must open with the title as its heading, `# <title>`")
    else:
        lines, first = lines[1:], 2

    claims: list[tuple[int, list[str]]] = []
    for number, line in enumerate(lines, start=first):
        claim = CLAIM.match(line)
        if claim:
            claims.append((int(claim.group(1)), []))
        elif line.startswith("#"):
            problems.append(f"body line {number}: only claims `## <n>. <claim>` go under the title")
        elif not claims:
            if line.strip():
                problems.append(f"body line {number}: text before the first claim")
        else:
            claims[-1][1].append(line)

    if not claims:
        problems.append("no claim: a Digest holds 1 to 6 claims, `## <n>. <claim>`")
    if len(claims) > MAX_CLAIMS:
        problems.append(f"{len(claims)} claims, {MAX_CLAIMS} at most")
    if [n for n, _ in claims] != list(range(1, len(claims) + 1)):
        problems.append("claims must be numbered 1, 2, 3… in order")

    for n, claim_lines in claims:
        extracts = [line for line in claim_lines if line.startswith(">")]
        if not 1 <= len(extracts) <= MAX_EXTRACTS:
            problems.append(f"claim {n} has {len(extracts)} Extracts, 1 to {MAX_EXTRACTS} wanted")
        for line in extracts:
            problems += [
                f"claim {n}: {problem}"
                for problem in _check_extract(line, youtube_id, duration, raw)
            ]
    return problems


def _check_extract(line: str, youtube_id: str, duration: int | None, raw: RawText) -> list[str]:
    timed, untimed = TIMED_EXTRACT.match(line), UNTIMED_EXTRACT.match(line)
    shown = line if len(line) <= 90 else line[:87] + "..."
    if raw.timed and not timed:
        return [f"`{shown}` is not an Extract: `> [m:ss](<watch url>&t=<n>s) « <quote> »`"]
    if not raw.timed:
        if timed:
            return [f"`{shown}` links a timestamp, and the Raw has none"]
        if not untimed:
            return [f"`{shown}` is not an Extract: `> « <quote> »`, the Raw having no timestamp"]
    match = timed or untimed
    quote = match.group("quote")
    problems = []
    if len(words(quote).split()) < MIN_QUOTE_WORDS:
        problems.append(f"the quote « {quote} » is shorter than {MIN_QUOTE_WORDS} words")
    seconds = None
    if timed:
        seconds = int(timed.group("seconds"))
        if timed.group("id") != youtube_id:
            problems.append(f"`{shown}` links another video than {youtube_id}")
        if clock_seconds(timed.group("label")) != seconds:
            problems.append(f"`{shown}`: its label {timed.group('label')} is not {seconds} s")
        if duration is not None and seconds >= duration:
            problems.append(f"`{shown}` links {seconds} s, past the video's {duration} s")
        if seconds not in raw.starts:
            problems.append(f"`{shown}`: the Raw has no block starting at {seconds} s")
            return problems
    if not raw.holds(quote, at=seconds):
        where = "in the Raw" if seconds is None else f"in the Raw's block at {seconds} s"
        problems.append(f"the quote « {quote} » is not {where}")
    return problems

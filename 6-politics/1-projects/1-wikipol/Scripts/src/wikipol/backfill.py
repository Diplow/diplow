"""`wikipol backfill`: digest a Source's Raws that have no up-to-date Digest, oldest first, and
file them in its Chronicle.

A Raw needs a Digest when the Chronicle holds none of it at today's `digest_version` and the model
pinned in `source.yaml`. The run takes those Raws by date, oldest first, has `write-digest` write
each one, and files them FILING_BATCH at a time: a batch is filed, the Periods it touched are
summarized again by `write-period`, deepest first, and the Chronicle is written before the next
batch is digested. Only then may the next Digests cite the ones just filed.

It resumes where it stopped. A Digest goes to a staging folder, outside the repo, as soon as it
passes the check, and leaves it once filed. A run that stops (a crash, a summary refused twice,
Ctrl-C) leaves its unfiled Digests there; the next run checks each one again, against its Raw and
the Chronicle as it is then, and files it without asking the model twice. What is filed is read
back from the Chronicle, so a run over a finished backfill writes nothing.

Skipped and reported: a Raw without a date, which has no place in a Chronicle
(decisions.md#DEC-14), and a Raw without usable captions, fewer spoken words than one Extract
quotes. A Digest refused twice, or a `claude -p` that gives no draft, is a failure; three in a row
stop the run, as in `wikipol fetch`. `limit` caps the Raws handed to the model, failures included,
so a sample never grows; Digests taken back from staging don't count.
"""

from __future__ import annotations

import os
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from wikipol.chronicle.filing import FilingError, plan_filing
from wikipol.chronicle.period import PeriodRejected, write_period
from wikipol.claude import Writer, WriterFailed
from wikipol.config import REPO_ROOT, Source, pinned_model
from wikipol.digest.format import DIGEST_VERSION, MIN_QUOTE_WORDS, check_digest, split_digest
from wikipol.digest.raw_text import RawText, parse_raw, words
from wikipol.digest.write import DigestRejected, digest_fields, linkable_digests, write_digest
from wikipol.legacy_index import LegacyNote, video_notes
from wikipol.raw_store import Raw, RawStore

FILING_BATCH = 6
MAX_FAILURES_IN_A_ROW = 3
# What captions put in brackets is not speech: [Musique], [Applaudissements], [Rires].
ANNOTATION = re.compile(r"\[[^\]]*\]")


def default_staging(slug: str) -> Path:
    """Where a Source's Digests wait to be filed: in the user's cache, outside every clone."""
    cache = os.environ.get("XDG_CACHE_HOME") or "~/.cache"
    return Path(cache).expanduser() / "wikipol" / "backfill" / slug


@dataclass(frozen=True)
class Candidate:
    """A Raw that needs a Digest, with what places it in the Chronicle."""

    raw: Raw
    raw_text: RawText
    note: LegacyNote | None
    published: date

    @property
    def youtube_id(self) -> str:
        return self.raw.youtube_id


@dataclass
class BackfillReport:
    source: str
    raws: int = 0
    up_to_date: int = 0
    """Raws whose Digest in the Chronicle is at today's digest_version and model."""
    to_digest: list[str] = field(default_factory=list)
    """Raws without an up-to-date Digest, which have a date and captions, oldest first."""
    no_date: list[str] = field(default_factory=list)
    no_captions: list[str] = field(default_factory=list)
    written: list[str] = field(default_factory=list)
    """Digests the model wrote this run."""
    resumed: list[str] = field(default_factory=list)
    """Digests a stopped run had written, taken back from staging."""
    filed: list[str] = field(default_factory=list)
    """The Digests filed this run, as repo paths where the run left them: a later batch may
    have moved one filed earlier."""
    summarized: int = 0
    failed: list[tuple[str, str]] = field(default_factory=list)
    rejected_drafts: Path | None = None
    stopped: str | None = None
    """Why the run stopped early, when it did."""

    @property
    def left(self) -> int:
        return len(self.to_digest) - len(self.filed)


def usable_captions(raw_text: RawText) -> bool:
    """Whether the Raw holds enough speech for one Extract."""
    spoken = " ".join(ANNOTATION.sub(" ", block.text) for block in raw_text.blocks)
    return len(words(spoken).split()) >= MIN_QUOTE_WORDS


def chronicle_digests(source: Source, repo_root: Path) -> dict[str, tuple[str, object, object]]:
    """The Digests in the Source's Chronicle: youtube_id -> (repo path without `.md`,
    digest_version, model)."""
    found: dict[str, tuple[str, object, object]] = {}
    chronicle = source.chronicle.resolve()
    if not chronicle.is_dir():
        return found
    for path in sorted(chronicle.rglob("*.md")):
        if path.name == "CLAUDE.md":
            continue
        frontmatter, _ = split_digest(path.read_text(encoding="utf-8"))
        if not frontmatter or "digest_version" not in frontmatter:
            continue
        try:
            where = path.relative_to(repo_root.resolve()).with_suffix("").as_posix()
        except ValueError:
            where = path.with_suffix("").as_posix()
        youtube_id = str(frontmatter.get("youtube_id") or "")
        found[youtube_id] = (where, frontmatter.get("digest_version"), frontmatter.get("model"))
    return found


def select(
    source: Source, store: RawStore, model: str, repo_root: Path, report: BackfillReport
) -> list[Candidate]:
    """The Raws that need a Digest and can have one, oldest first; the others go in the report."""
    current = {
        youtube_id
        for youtube_id, (_, version, written_by) in chronicle_digests(source, repo_root).items()
        if version == DIGEST_VERSION and written_by == model
    }
    notes = video_notes(source.legacy_vault)
    ids = store.list(source.slug)
    report.raws = len(ids)
    candidates: list[Candidate] = []
    for youtube_id in ids:
        if youtube_id in current:
            report.up_to_date += 1
            continue
        raw = store.get(source.slug, youtube_id)
        note = notes.get(youtube_id)
        # The date the Digest will carry: digest_fields reads it the same way.
        published = raw.meta.published or (note.published if note else None)
        if published is None:
            report.no_date.append(youtube_id)
            continue
        try:
            raw_text = parse_raw(raw.body.decode("utf-8"))
        except UnicodeDecodeError:
            report.no_captions.append(youtube_id)
            continue
        if not usable_captions(raw_text):
            report.no_captions.append(youtube_id)
            continue
        candidates.append(Candidate(raw, raw_text, note, published))
    candidates.sort(key=lambda c: (c.published, c.youtube_id))
    report.to_digest = [c.youtube_id for c in candidates]
    return candidates


def take_staged(
    path: Path,
    source: Source,
    candidate: Candidate,
    model: str,
    parent: str,
    linkable: dict[str, str],
) -> str | None:
    """The Digest a stopped run left in staging, when it still passes the check against its Raw
    and the Chronicle as it is now; anything else is dropped, to be written again."""
    if not path.is_file():
        return None
    text = path.read_text(encoding="utf-8")
    frontmatter, _ = split_digest(text)
    frontmatter = frontmatter or {}
    problems = ["not at today's digest_version and model"]
    if frontmatter.get("digest_version") == DIGEST_VERSION and frontmatter.get("model") == model:
        expected = digest_fields(
            source,
            candidate.raw,
            candidate.note,
            parent=parent,
            ingested=frontmatter.get("ingested"),
            model=model,
        )
        problems = check_digest(text, candidate.raw_text, expected, set(linkable))
    if problems:
        path.unlink()
        return None
    return text


def backfill(
    source: Source,
    store: RawStore,
    writer: Writer,
    staging: Path,
    today: date,
    limit: int | None = None,
    dry_run: bool = False,
    repo_root: Path = REPO_ROOT,
    batch: int = FILING_BATCH,
    log: Callable[[str], None] = lambda _: None,
) -> BackfillReport:
    """Digests and files what the Source lacks; raises ConfigError for a Source without a pinned
    model. Everything else that goes wrong is in the report."""
    model = pinned_model(source)
    report = BackfillReport(source.slug)
    candidates = select(source, store, model, repo_root, report)
    log(
        f"{source.slug}: {report.raws} Raws, {report.up_to_date} with an up-to-date Digest, "
        f"{len(report.to_digest)} to digest"
    )
    if dry_run:
        return report

    staging.mkdir(parents=True, exist_ok=True)
    # A staged Digest of a Raw that needs none any more (filed by a run stopped before it cleared
    # its staging, or from another clone) would sit there for good.
    for path in staging.glob("*.md"):
        if path.stem not in report.to_digest:
            path.unlink()
    # Until it is filed, a Digest's parent is the Chronicle, as `wikipol digest` has it.
    chronicle = source.chronicle.resolve()
    parent = (
        chronicle.relative_to(repo_root.resolve()).as_posix()
        if chronicle.is_relative_to(repo_root.resolve())
        else chronicle.as_posix()
    )
    pending: list[tuple[str, str]] = []
    filed: list[str] = []
    tried = failures_in_a_row = 0

    def refuse(youtube_id: str, reason: str, draft: str) -> None:
        report.failed.append((youtube_id, reason))
        log(f"  {youtube_id}: failed, {reason}")
        report.rejected_drafts = staging / "rejected"
        report.rejected_drafts.mkdir(exist_ok=True)
        (report.rejected_drafts / f"{youtube_id}.md").write_text(draft, encoding="utf-8")

    def drop_unfileable() -> None:
        """Takes out of the batch, and out of staging, each Digest the Chronicle refuses on its
        own (a Digest filed before on another date, decisions.md#DEC-14), so one such Digest
        doesn't hold back the others at every run."""
        for youtube_id, text in list(pending):
            try:
                plan_filing(source, [text], repo_root=repo_root)
            except FilingError as error:
                pending.remove((youtube_id, text))
                (staging / f"{youtube_id}.md").unlink(missing_ok=True)
                refuse(youtube_id, f"can't be filed: {error}", text)

    def file_pending() -> bool:
        """Files the pending Digests; False, with the reason in the report, when it couldn't."""
        try:
            filing = plan_filing(source, [text for _, text in pending], repo_root=repo_root)
        except FilingError:
            drop_unfileable()
            filing = None
        if not pending:
            return True
        try:
            filing = filing or plan_filing(
                source, [text for _, text in pending], repo_root=repo_root
            )
            filing.summarize(
                lambda period, whole: write_period(source, period, writer, chronicle=whole)
            )
            filing.apply()
        except (FilingError, PeriodRejected, WriterFailed) as error:
            problems = getattr(error, "problems", [])
            why = "; ".join([f"filing stopped, the Chronicle is unchanged: {error}", *problems])
            report.stopped = f"{report.stopped}; {why}" if report.stopped else why
            log(f"  {why}")
            return False
        report.summarized += len(filing.touched())
        filed.extend(leaf.youtube_id for leaf in filing.filed)
        for youtube_id, _ in pending:
            (staging / f"{youtube_id}.md").unlink(missing_ok=True)
        log(f"  filed {len(pending)}, {len(filing.touched())} Periods summarized")
        pending.clear()
        return True

    filed_before = chronicle_digests(source, repo_root)
    linkable = linkable_digests(source, repo_root)
    for candidate in candidates:
        youtube_id = candidate.youtube_id
        # An outdated Digest it replaces is not one it may cite.
        own = filed_before[youtube_id][0] if youtube_id in filed_before else None
        links = {target: title for target, title in linkable.items() if target != own}
        staged = staging / f"{youtube_id}.md"
        text = take_staged(staged, source, candidate, model, parent, links)
        if text is not None:
            report.resumed.append(youtube_id)
            log(f"  {youtube_id}: taken back from staging")
        else:
            if limit is not None and tried >= limit:
                continue
            tried += 1
            try:
                digest = write_digest(
                    source,
                    youtube_id,
                    store,
                    writer,
                    parent=parent,
                    today=today,
                    linkable=links,
                )
            except DigestRejected as error:
                refuse(youtube_id, "; ".join([str(error), *error.problems]), error.draft)
                failures_in_a_row += 1
            except WriterFailed as error:
                report.failed.append((youtube_id, str(error)))
                log(f"  {youtube_id}: failed, {error}")
                failures_in_a_row += 1
            else:
                failures_in_a_row = 0
            if failures_in_a_row:
                if failures_in_a_row >= MAX_FAILURES_IN_A_ROW:
                    report.stopped = f"{MAX_FAILURES_IN_A_ROW} failures in a row"
                    file_pending()  # what the model wrote before them is filed all the same
                    break
                continue
            text = digest.text
            staged.write_text(text, encoding="utf-8")
            report.written.append(youtube_id)
            log(f"  {youtube_id}: written in {digest.drafts} draft(s), {digest.fields.title}")
        pending.append((youtube_id, text))
        if len(pending) >= batch:
            if not file_pending():
                break  # the batch stays in staging, for the next run
            filed_before = chronicle_digests(source, repo_root)
            linkable = linkable_digests(source, repo_root)
    else:
        file_pending()
    where = chronicle_digests(source, repo_root)
    report.filed = [f"{where[youtube_id][0]}.md" for youtube_id in filed if youtube_id in where]
    return report


def format_report(report: BackfillReport, limit: int | None = None, dry_run: bool = False) -> str:
    head = (
        f"{report.source}: {report.raws} Raws, {report.up_to_date} with an up-to-date Digest, "
        f"{len(report.no_date)} without a date, {len(report.no_captions)} without usable "
        f"captions, {len(report.to_digest)} to digest"
    )
    if dry_run:
        lines = [f"{head}, oldest first:"]
        lines.extend(f"  would digest: {youtube_id}" for youtube_id in report.to_digest[:limit])
    else:
        lines = [
            f"{head}; written {len(report.written)}, taken back from staging "
            f"{len(report.resumed)}, filed {len(report.filed)}, {report.summarized} Periods "
            f"summarized, {len(report.failed)} failed, {report.left} left for a later run"
        ]
        lines.extend(f"  filed: {path}" for path in report.filed)
        lines.extend(f"  failed: {youtube_id}, {reason}" for youtube_id, reason in report.failed)
        if report.rejected_drafts:
            lines.append(f"  rejected drafts kept in {report.rejected_drafts}")
        if report.stopped:
            lines.append(f"  stopped: {report.stopped}")
    lines.extend(f"  no date, can't be filed: {youtube_id}" for youtube_id in report.no_date)
    lines.extend(f"  no usable captions: {youtube_id}" for youtube_id in report.no_captions)
    return "\n".join(lines)

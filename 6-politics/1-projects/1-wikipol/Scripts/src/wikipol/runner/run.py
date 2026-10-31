"""`wikipol run`: the daily run. For each Source, fetch the new videos' Raws into the bucket, then
digest the Raws that lack a Digest and file them in the Chronicle (`wikipol backfill`); then index
what the search index lacks; then publish what changed, one branch and one merged pull request.

Every step is the command of the same name, so each is idempotent on its own: the Fetcher skips
what the bucket holds, the backfill what the Chronicle holds and what staging kept, the index
what it indexed. A run over a day without a new video writes nothing and opens no pull request.

Three failures in a row stop a step for a Source, as each command already does. The run then
skips that step for the Sources after it, which would fare no better (YouTube refusing the Mac,
claude failing), and carries on with the next steps: Digests already filed are still published.
The index comes after the Digests, so a Publication it adds carries its Digest's path, and its
failing (a missing setting, a key refused, a database without tables) stops nothing else.

A step that raises is caught at its boundary, its traceback logged, and counted as a failure:
nobody watches the run, and what the steps before it wrote must still be published.
"""

from __future__ import annotations

import os
import sys
import time
import traceback
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from wikipol.backfill import BackfillReport, backfill, default_staging
from wikipol.backfill import format_report as format_backfill_report
from wikipol.claude import Writer
from wikipol.config import Source
from wikipol.fetch.fetcher import Fetcher
from wikipol.fetch.run import FetchReport, fetch_source
from wikipol.fetch.run import format_report as format_fetch_report
from wikipol.index.run import IndexReport
from wikipol.index.run import format_report as format_index_report
from wikipol.index.store import IndexUnreachable
from wikipol.raw_store import RawStore
from wikipol.runner.repo import RUN_BRANCH_PREFIX, GitFailed, RunnerRepo

Log = Callable[[str], None]
IndexStep = Callable[[list[Source], bool], list[IndexReport]]
"""Indexes the Sources' new Raws (or, when the flag says dry run, counts them). Raises when the
index can't be reached."""


@dataclass
class SourceRun:
    source: str
    fetched: FetchReport | None = None
    digested: BackfillReport | None = None


@dataclass
class RunReport:
    started: datetime
    base: str
    dry_run: bool
    sources: list[SourceRun] = field(default_factory=list)
    indexed: list[IndexReport] = field(default_factory=list)
    leftovers: list[str] = field(default_factory=list)
    """Files a stopped run left changed, carried by this run's commit."""
    changed: list[str] = field(default_factory=list)
    failures: list[str] = field(default_factory=list)
    """One line per failure: a video, a Digest, a step that raised, the index, the publishing."""
    pull_request: str | None = None

    @property
    def new_digests(self) -> list[str]:
        return [path for s in self.sources if s.digested for path in s.digested.filed]


@dataclass
class Pipeline:
    """What the steps run on: the bucket, the Fetcher, the writer behind `claude -p`, the index,
    and the repo whose Chronicles they file into."""

    store: RawStore
    fetcher: Fetcher
    writer: Writer
    index: IndexStep
    repo_root: Path
    limit: int | None = None
    """At most this many videos fetched and Raws digested per Source: a sample, never a backfill."""
    staging: Callable[[str], Path] = default_staging
    sleep: Callable[[float], None] = time.sleep
    log: Log = lambda _: None


def daily_run(
    sources: list[Source],
    pipeline: Pipeline,
    repo: RunnerRepo,
    now: datetime,
    dry_run: bool = False,
) -> RunReport:
    report = RunReport(now, repo.base, dry_run)
    log = pipeline.log
    if dry_run:
        log(describe_dry_run(repo))
        run_steps(sources, pipeline, report)
        return report
    try:
        with repo.git.locked():
            report.leftovers = repo.prepare(log)
            if report.leftovers:
                log(f"carried from a stopped run: {', '.join(report.leftovers)}")
            run_steps(sources, pipeline, report)
            publish(repo, report, log)
    except GitFailed as error:
        # A clone that isn't the runner's, one another run holds, or a base that can't be
        # fast-forwarded: writing there is worse than not running.
        report.failures.append(f"prepare: {error}")
    return report


def run_steps(sources: list[Source], pipeline: Pipeline, report: RunReport) -> None:
    p, dry_run, log = pipeline, report.dry_run, pipeline.log

    def step(name: str, action: Callable[[], None]) -> bool:
        """Runs one step; False, the failure logged and reported, when it raised."""
        try:
            action()
        except Exception as error:  # the run's boundary: see the module's docstring
            log(traceback.format_exc().rstrip())
            report.failures.append(f"{name}: {type(error).__name__}: {error}")
            return False
        return True

    fetch_stopped = digest_stopped = False
    for source in sources:
        run = SourceRun(source.slug)
        report.sources.append(run)

        def fetch(source: Source = source, run: SourceRun = run) -> None:
            run.fetched = fetch_source(
                source, p.store, p.fetcher, limit=p.limit, dry_run=dry_run, sleep=p.sleep, log=log
            )
            log(format_fetch_report(run.fetched, dry_run=dry_run))

        def digest(source: Source = source, run: SourceRun = run) -> None:
            run.digested = backfill(
                source,
                p.store,
                p.writer,
                staging=p.staging(source.slug),
                today=report.started.date(),
                limit=p.limit,
                dry_run=dry_run,
                repo_root=p.repo_root,
                log=log,
            )
            log(format_backfill_report(run.digested, limit=p.limit, dry_run=dry_run))

        if fetch_stopped:
            log(f"{source.slug}: not fetched, the Fetcher stopped on a Source before")
        elif step(f"{source.slug} fetch", fetch) and run.fetched:
            report.failures.extend(
                f"{source.slug} fetch {youtube_id}: {why}" for youtube_id, why in run.fetched.failed
            )
            fetch_stopped = run.fetched.stopped
        if digest_stopped:
            log(f"{source.slug}: not digested, the digests stopped on a Source before")
        elif step(f"{source.slug} digest", digest) and run.digested:
            report.failures.extend(
                f"{source.slug} digest {youtube_id}: {why}"
                for youtube_id, why in run.digested.failed
            )
            if run.digested.stopped:
                report.failures.append(f"{source.slug} digest stopped: {run.digested.stopped}")
                digest_stopped = True

    def search_index() -> None:
        try:
            report.indexed = p.index(sources, dry_run)
        except IndexUnreachable as error:
            report.indexed = error.reports  # what the Sources before the failure committed
            raise
        log(format_index_report(report.indexed, dry_run=dry_run))

    if step("index", search_index):
        report.failures.extend(
            f"index {r.source}: {r.stopped}" for r in report.indexed if r.stopped
        )


def publish(repo: RunnerRepo, report: RunReport, log: Log) -> None:
    """One branch and one merged pull request for what the steps changed, or nothing."""
    report.changed = repo.git.changes()
    if not report.changed:
        log("nothing new: no branch, no pull request")
        return
    branch = f"{RUN_BRANCH_PREFIX}{report.started:%Y-%m-%d-%H%M%S}"
    try:
        report.pull_request = repo.publish(branch, title(report), format_summary(report))
    except GitFailed as error:
        report.failures.append(f"publish: {error}; the files wait in the clone for the next run")
        return
    log(f"published: {report.pull_request}")


def describe_dry_run(repo: RunnerRepo) -> str:
    git = repo.git
    changed = git.changes()
    return (
        f"dry run in {git.root}, on {git.branch()} with {len(changed)} changed files: a run would "
        f"fast-forward {repo.base}, then commit what the steps write on "
        f"{RUN_BRANCH_PREFIX}<stamp> and merge its pull request into {repo.base}; "
        f"this one fetches, digests, files and publishes nothing"
    )


def title(report: RunReport) -> str:
    digests = len(report.new_digests)
    what = f"{digests} Digest{'s' if digests != 1 else ''}" if digests else "the Chronicle"
    return f"wikipol: daily run of {report.started:%Y-%m-%d}, {what}"


def format_summary(report: RunReport) -> str:
    """The run in a few lines: the log file, and the pull request's body."""
    head = "dry run" if report.dry_run else "run"
    lines = [f"wikipol {head} of {report.started:%Y-%m-%d %H:%M}, onto {report.base}"]
    for s in report.sources:
        parts = []
        if s.fetched and report.dry_run:
            parts.append(f"{len(s.fetched.missing)} videos without a Raw")
        elif s.fetched:
            parts.append(
                f"{len(s.fetched.stored)} Raws stored, {len(s.fetched.no_captions)} videos "
                "waiting for captions"
            )
        if s.digested and report.dry_run:
            parts.append(f"{len(s.digested.to_digest)} Raws to digest")
        elif s.digested:
            parts.append(
                f"{len(s.digested.written)} Digests written, {len(s.digested.filed)} filed, "
                f"{s.digested.summarized} Periods summarized"
            )
        lines.append(f"- {s.source}: {'; '.join(parts) or 'nothing ran'}")
    if report.indexed:
        verb = "to index" if report.dry_run else "indexed"
        count = sum(len(r.indexed) for r in report.indexed)
        lines.append(f"- index: {count} Publications {verb}")
    lines.extend(f"- new Digest: {path}" for path in report.new_digests)
    lines.extend(f"- carried from a stopped run: {path}" for path in report.leftovers)
    if report.pull_request:
        lines.append(f"- published: {report.pull_request}")
    elif not report.dry_run and not report.changed and not report.failures:
        lines.append("- nothing new: no pull request")
    lines.extend(f"- failed: {failure}" for failure in report.failures)
    return "\n".join(lines)


def default_log_dir() -> Path:
    """Where launchd's runs leave their logs: ~/Library/Logs on a Mac, which Console.app reads;
    the user's state folder elsewhere."""
    if sys.platform == "darwin":
        return Path("~/Library/Logs/wikipol").expanduser()
    state = os.environ.get("XDG_STATE_HOME") or "~/.local/state"
    return Path(state).expanduser() / "wikipol" / "logs"


def log_path(log_dir: Path, started: datetime) -> Path:
    return log_dir / f"run-{started:%Y-%m-%dT%H%M%S}.log"

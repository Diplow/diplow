"""`wikipol fetch`: list a Source's channel, store the Raws the bucket lacks, newest first.

The safeguards of `batch_transcripts.py` hold: an 8-second pause between two videos, so YouTube
doesn't ban the IP, and a stop after 3 failures in a row, which says something is wrong beyond
one video. `limit` caps the videos tried, not the ones stored, so a sample never grows.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field

from wikipol.config import ConfigError, Source
from wikipol.fetch.fetcher import Fetcher, FetchFailed
from wikipol.raw_store import RawExists, RawStore

PAUSE_SECONDS = 8
MAX_FAILURES_IN_A_ROW = 3


@dataclass
class FetchReport:
    source: str
    listed: int = 0
    missing: list[str] = field(default_factory=list)
    """On the channel, not in the bucket, newest first."""
    stored: list[str] = field(default_factory=list)
    already_there: list[str] = field(default_factory=list)
    failed: list[tuple[str, str]] = field(default_factory=list)
    stopped: bool = False
    """Stopped after MAX_FAILURES_IN_A_ROW failures in a row."""

    @property
    def tried(self) -> int:
        return len(self.stored) + len(self.already_there) + len(self.failed)


def fetch_source(
    source: Source,
    store: RawStore,
    fetcher: Fetcher,
    limit: int | None = None,
    dry_run: bool = False,
    sleep: Callable[[float], None] = time.sleep,
    log: Callable[[str], None] = lambda _: None,
) -> FetchReport:
    if not source.channel_url:
        raise ConfigError(f"{source.slug}: source.yaml has no youtube.channel_url")
    report = FetchReport(source.slug)
    listed = fetcher.list_channel(source.channel_url)
    stored = set(store.list(source.slug))
    report.listed = len(listed)
    report.missing = [video for video in dict.fromkeys(listed) if video not in stored]
    log(f"{source.slug}: {len(listed)} videos on the channel, {len(report.missing)} without a Raw")
    if dry_run:
        return report

    failures_in_a_row = 0
    for i, youtube_id in enumerate(report.missing[:limit]):
        if i:
            sleep(PAUSE_SECONDS)
        try:
            fetched = fetcher.fetch(youtube_id)
            store.put(source.slug, youtube_id, fetched.body, fetched.meta)
        except FetchFailed as error:
            report.failed.append((youtube_id, str(error)))
            log(f"  {youtube_id}: failed, {error}")
            failures_in_a_row += 1
            if failures_in_a_row >= MAX_FAILURES_IN_A_ROW:
                report.stopped = True
                break
            continue
        except RawExists:  # another writer stored it since the listing
            report.already_there.append(youtube_id)
        else:
            report.stored.append(youtube_id)
            log(f"  {youtube_id}: stored, {fetched.meta.title}")
        failures_in_a_row = 0
    return report


def format_report(report: FetchReport, dry_run: bool = False) -> str:
    if dry_run:
        lines = [
            f"{report.source}: {report.listed} on the channel, "
            f"{len(report.missing)} without a Raw, newest first:"
        ]
        lines.extend(f"  would fetch: {youtube_id}" for youtube_id in report.missing)
        return "\n".join(lines)
    left = len(report.missing) - report.tried
    lines = [
        f"{report.source}: {report.listed} on the channel, {len(report.missing)} without a Raw; "
        f"stored {len(report.stored)}, {len(report.already_there)} already there, "
        f"{len(report.failed)} failed, {left} left for a later run"
    ]
    lines.extend(f"  stored: {youtube_id}" for youtube_id in report.stored)
    lines.extend(f"  failed: {youtube_id}, {reason}" for youtube_id, reason in report.failed)
    if report.stopped:
        lines.append(f"  stopped after {MAX_FAILURES_IN_A_ROW} failures in a row")
    return "\n".join(lines)

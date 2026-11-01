"""`wikipol fetch`: list a Source's channel, store the Raws the bucket lacks, newest first.

The safeguards of `batch_transcripts.py` hold: an 8-second pause between two videos, so YouTube
doesn't ban the IP, and a stop after 3 failures in a row, which says something is wrong beyond
one video. A video YouTube has no French captions for is skipped without counting as one: it says
nothing about the Fetcher, and it is tried again next run, since captions can come hours after an
upload. `limit` caps the videos tried, not the ones stored, so a sample never grows.

`since` keeps a channel's recent past only. The listing carries no dates, so a video's date is
known once it is fetched: one published before `since` is not stored, and 3 of them in a row end
the run, since the channel lists newest first and one old video may only be out of order.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date

from wikipol.config import ConfigError, Source
from wikipol.fetch.fetcher import Fetcher, FetchFailed, NoCaptions
from wikipol.raw_store import RawExists, RawStore

PAUSE_SECONDS = 8
MAX_FAILURES_IN_A_ROW = 3
MAX_OLDER_IN_A_ROW = 3


@dataclass
class FetchReport:
    source: str
    listed: int = 0
    missing: list[str] = field(default_factory=list)
    """On the channel, not in the bucket, newest first."""
    stored: list[str] = field(default_factory=list)
    already_there: list[str] = field(default_factory=list)
    no_captions: list[str] = field(default_factory=list)
    failed: list[tuple[str, str]] = field(default_factory=list)
    older: list[str] = field(default_factory=list)
    """Fetched, published before `since`, and not stored."""
    stopped: bool = False
    """Stopped after MAX_FAILURES_IN_A_ROW failures in a row."""
    since: date | None = None
    reached_since: bool = False
    """Ended after MAX_OLDER_IN_A_ROW videos in a row published before `since`."""

    @property
    def tried(self) -> int:
        return (
            len(self.stored)
            + len(self.already_there)
            + len(self.no_captions)
            + len(self.failed)
            + len(self.older)
        )


def fetch_source(
    source: Source,
    store: RawStore,
    fetcher: Fetcher,
    limit: int | None = None,
    since: date | None = None,
    dry_run: bool = False,
    sleep: Callable[[float], None] = time.sleep,
    log: Callable[[str], None] = lambda _: None,
) -> FetchReport:
    if not source.channel_url:
        raise ConfigError(f"{source.slug}: source.yaml has no youtube.channel_url")
    report = FetchReport(source.slug, since=since)
    listed = fetcher.list_channel(source.channel_url)
    stored = set(store.list(source.slug))
    report.listed = len(listed)
    report.missing = [video for video in dict.fromkeys(listed) if video not in stored]
    log(f"{source.slug}: {len(listed)} videos on the channel, {len(report.missing)} without a Raw")
    if dry_run:
        return report

    failures_in_a_row = older_in_a_row = 0
    for i, youtube_id in enumerate(report.missing[:limit]):
        if i:
            sleep(PAUSE_SECONDS)
        try:
            fetched = fetcher.fetch(youtube_id)
            published = fetched.meta.published
            if since is not None and published is not None and published < since:
                report.older.append(youtube_id)
                log(f"  {youtube_id}: published {published}, before {since}, not stored")
                failures_in_a_row = 0
                older_in_a_row += 1
                if older_in_a_row >= MAX_OLDER_IN_A_ROW:
                    report.reached_since = True
                    break
                continue
            store.put(source.slug, youtube_id, fetched.body, fetched.meta)
        except NoCaptions:
            report.no_captions.append(youtube_id)
            log(f"  {youtube_id}: no French captions yet, left for a later run")
            continue
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
        failures_in_a_row = older_in_a_row = 0
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
        f"{len(report.no_captions)} without French captions, {len(report.failed)} failed, "
        + (
            f"{len(report.older)} published before {report.since}, "
            if report.since is not None
            else ""
        )
        + (
            f"and the {left} after them are older still"
            if report.reached_since
            else f"{left} left for a later run"
        )
    ]
    lines.extend(f"  stored: {youtube_id}" for youtube_id in report.stored)
    lines.extend(f"  no French captions yet: {youtube_id}" for youtube_id in report.no_captions)
    lines.extend(f"  failed: {youtube_id}, {reason}" for youtube_id, reason in report.failed)
    lines.extend(f"  published before {report.since}: {youtube_id}" for youtube_id in report.older)
    if report.stopped:
        lines.append(f"  stopped after {MAX_FAILURES_IN_A_ROW} failures in a row")
    if report.reached_since:
        lines.append(
            f"  ended after {MAX_OLDER_IN_A_ROW} videos in a row published before {report.since}"
        )
    return "\n".join(lines)

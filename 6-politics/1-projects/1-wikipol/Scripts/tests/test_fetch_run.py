"""`wikipol fetch` on a fake Fetcher and the in-memory store: what gets tried, paused, stored."""

from datetime import date
from pathlib import Path

import pytest

from wikipol.config import ConfigError, Source
from wikipol.fetch.fetcher import Fetched, FetchFailed, NoCaptions
from wikipol.fetch.run import PAUSE_SECONDS, fetch_source, format_report
from wikipol.raw_store import InMemoryRawStore, RawExists, RawMeta

CHANNEL = "https://www.youtube.com/@Demo/videos"
SOURCE = Source("Demo", "demo", Path("/nowhere"), None, None, channel_url=CHANNEL)


class FakeFetcher:
    """A channel of 11-character ids, newest first; `failing` ids raise FetchFailed, `silent`
    ones NoCaptions, and `published` dates some, the others 2026-10-30."""

    def __init__(self, channel, failing=(), silent=(), published=None):
        self.channel, self.failing, self.silent = channel, set(failing), set(silent)
        self.published = published or {}
        self.fetched: list[str] = []

    def list_channel(self, channel_url):
        assert channel_url == CHANNEL
        return list(self.channel)

    def fetch(self, youtube_id):
        self.fetched.append(youtube_id)
        if youtube_id in self.silent:
            raise NoCaptions("no French captions on YouTube yet")
        if youtube_id in self.failing:
            raise FetchFailed("yt-dlp exited with 1: ERROR: Sign in to confirm")
        published = self.published.get(youtube_id, date(2026, 10, 30))
        meta = RawMeta(f"Titre {youtube_id}", published, 600)
        return Fetched(youtube_id, f"raw of {youtube_id}".encode(), meta)


def vid(n: int) -> str:
    return f"video{n:06d}"


@pytest.fixture
def pauses():
    calls: list[float] = []
    return calls


def run(fetcher, store, pauses, **kwargs):
    return fetch_source(SOURCE, store, fetcher, sleep=pauses.append, **kwargs)


def test_only_videos_without_a_raw_are_fetched_newest_first(pauses):
    store = InMemoryRawStore()
    store.put("demo", vid(2), b"already", RawMeta("t"))
    fetcher = FakeFetcher([vid(1), vid(2), vid(3)])

    report = run(fetcher, store, pauses)

    assert fetcher.fetched == [vid(1), vid(3)]
    assert report.stored == [vid(1), vid(3)]
    assert store.get("demo", vid(1)).meta == RawMeta("Titre video000001", date(2026, 10, 30), 600)
    assert store.get("demo", vid(2)).body == b"already"


def test_eight_seconds_pass_between_two_videos(pauses):
    run(FakeFetcher([vid(1), vid(2), vid(3)]), InMemoryRawStore(), pauses)

    assert pauses == [PAUSE_SECONDS, PAUSE_SECONDS]
    assert PAUSE_SECONDS == 8


def test_the_limit_caps_the_videos_tried_failures_included(pauses):
    fetcher = FakeFetcher([vid(1), vid(2), vid(3), vid(4)], failing=[vid(1)])

    report = run(fetcher, InMemoryRawStore(), pauses, limit=3)

    assert fetcher.fetched == [vid(1), vid(2), vid(3)]
    assert report.stored == [vid(2), vid(3)]
    assert report.failed == [(vid(1), "yt-dlp exited with 1: ERROR: Sign in to confirm")]
    assert "1 left for a later run" in format_report(report)


def test_three_videos_in_a_row_published_before_since_end_the_run_unstored(pauses):
    channel = [vid(n) for n in range(1, 7)]
    old = {vid(n): date(2023, 5, 1) for n in range(2, 7)}
    fetcher = FakeFetcher(channel, published=old)

    report = run(fetcher, InMemoryRawStore(), pauses, since=date(2023, 10, 31))

    assert fetcher.fetched == [vid(1), vid(2), vid(3), vid(4)]
    assert report.stored == [vid(1)]
    assert report.older == [vid(2), vid(3), vid(4)]
    assert report.reached_since and not report.stopped
    assert "and the 2 after them are older still" in format_report(report)


def test_one_old_video_out_of_order_does_not_end_the_run(pauses):
    channel = [vid(n) for n in range(1, 5)]
    fetcher = FakeFetcher(channel, published={vid(2): date(2019, 1, 1)})

    report = run(fetcher, InMemoryRawStore(), pauses, since=date(2023, 10, 31))

    assert report.stored == [vid(1), vid(3), vid(4)]
    assert report.older == [vid(2)]
    assert not report.reached_since


def test_three_failures_in_a_row_stop_the_run(pauses):
    channel = [vid(n) for n in range(1, 8)]
    fetcher = FakeFetcher(channel, failing=[vid(1), vid(3), vid(4), vid(5), vid(6)])

    report = run(fetcher, InMemoryRawStore(), pauses)

    # 1 fails, 2 resets the count, 3 4 5 fail in a row: 6 and 7 are never tried.
    assert fetcher.fetched == [vid(n) for n in range(1, 6)]
    assert report.stopped
    assert "stopped after 3 failures in a row" in format_report(report)


def test_videos_without_french_captions_neither_stop_the_run_nor_break_a_streak(pauses):
    channel = [vid(n) for n in range(1, 8)]
    fetcher = FakeFetcher(
        channel, failing=[vid(1), vid(3), vid(5)], silent=[vid(2), vid(4), vid(6)]
    )

    report = run(fetcher, InMemoryRawStore(), pauses, limit=6)

    # 1, 3 and 5 fail with 2 and 4 between them, silent: the third failure in a row stops it.
    assert fetcher.fetched == [vid(n) for n in range(1, 6)]
    assert report.no_captions == [vid(2), vid(4)]
    assert report.stopped
    assert "no French captions yet: video000002" in format_report(report)


def test_only_videos_without_captions_never_stop_the_run(pauses):
    channel = [vid(n) for n in range(1, 6)]
    fetcher = FakeFetcher(channel, silent=channel[:4])

    report = run(fetcher, InMemoryRawStore(), pauses)

    assert not report.stopped
    assert report.stored == [vid(5)]


def test_a_raw_another_writer_stored_meanwhile_is_left_as_it_is(pauses):
    class RacingStore(InMemoryRawStore):
        def put(self, source, youtube_id, body, meta):
            super().put(source, youtube_id, b"the other writer's", meta)
            raise RawExists(youtube_id)

    store = RacingStore()

    report = run(FakeFetcher([vid(1)]), store, pauses)

    assert report.already_there == [vid(1)]
    assert store.get("demo", vid(1)).body == b"the other writer's"


def test_a_dry_run_lists_without_fetching(pauses):
    fetcher = FakeFetcher([vid(1), vid(2)])
    store = InMemoryRawStore()

    report = run(fetcher, store, pauses, dry_run=True)

    assert fetcher.fetched == []
    assert store.list("demo") == []
    assert report.missing == [vid(1), vid(2)]
    assert "would fetch: video000002" in format_report(report, dry_run=True)


def test_a_source_without_a_channel_is_a_config_error(pauses):
    source = Source("Demo", "demo", Path("/nowhere"), None, None)

    with pytest.raises(ConfigError, match="channel_url"):
        fetch_source(source, InMemoryRawStore(), FakeFetcher([]), sleep=pauses.append)

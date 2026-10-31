"""`wikipol run` end to end on fakes: a fake Fetcher, the in-memory bucket, a fake `claude -p`,
an in-memory index, and real git between the runner's clone and a bare repo standing in for
GitHub's. No YouTube, no Scaleway, no Anthropic, no GitHub."""

from __future__ import annotations

from datetime import date, datetime

import pytest
from conftest import FakeGitHub, git, write
from test_backfill import FakeWriter, raw
from test_index_run import FakeEmbedder

from wikipol import cli
from wikipol.config import ConfigError, load_sources
from wikipol.fetch.fetcher import Fetched, FetchFailed
from wikipol.index.run import index_source
from wikipol.index.store import InMemoryIndex
from wikipol.raw_store import InMemoryRawStore, RawMeta
from wikipol.runner.repo import Git, RunnerRepo
from wikipol.runner.run import Pipeline, daily_run, format_summary

MODEL = "claude-sonnet-5-5"
NOW = datetime(2026, 10, 31, 7, 0)
CHRONICLE = "6-politics/2-sources/1-demo/1-chronicle"


class FakeFetcher:
    """A channel per URL, newest first; `failing` ids raise FetchFailed."""

    def __init__(self, channels: dict[str, list[str]], failing=(), unlisted=()):
        self.channels, self.failing, self.unlisted = channels, set(failing), set(unlisted)
        self.listed: list[str] = []
        self.fetched: list[str] = []

    def list_channel(self, channel_url):
        self.listed.append(channel_url)
        if channel_url in self.unlisted:
            raise FetchFailed("yt-dlp exited with 1: ERROR: Sign in to confirm you're not a bot")
        return list(self.channels[channel_url])

    def fetch(self, youtube_id):
        self.fetched.append(youtube_id)
        if youtube_id in self.failing:
            raise FetchFailed("yt-dlp exited with 1: ERROR: Sign in to confirm")
        return Fetched(
            youtube_id, raw(youtube_id), RawMeta(f"VIDÉO {youtube_id}", date(2026, 10, 30), 600)
        )


def source_yaml(name: str, slug: str) -> str:
    return f"""
        source:
          name: {name}
          slug: {slug}
          attribution: "la {name}"
        youtube:
          channel_url: https://www.youtube.com/@{name}/videos
        claude:
          default_model: {MODEL}
        """


@pytest.fixture
def remote(tmp_path):
    """GitHub's repo: main holds two Sources, each with an empty Chronicle."""
    seed = tmp_path / "seed"
    for n, (name, slug) in enumerate([("Demo", "demo"), ("Autre", "autre")], start=1):
        node = seed / "6-politics" / "2-sources" / f"{n}-{slug}"
        write(node / "source.yaml", source_yaml(name, slug))
        write(node / "CLAUDE.md", f"# {name}\n\nRestituer, pas neutraliser.\n")
        write(node / "1-chronicle" / "CLAUDE.md", "---\ntitle: Chronicle\n---\n# Chronicle\n")
    git(seed, "init", "--quiet")
    git(seed, "add", ".")
    git(seed, "commit", "--quiet", "-m", "seed")
    git(tmp_path, "clone", "--quiet", "--bare", str(seed), "remote.git")
    return tmp_path / "remote.git"


@pytest.fixture
def clone(tmp_path, remote):
    git(tmp_path, "clone", "--quiet", str(remote), "runner")
    git(tmp_path / "runner", "config", "wikipol.runner", "true")
    return tmp_path / "runner"


@pytest.fixture
def github(tmp_path, remote):
    return FakeGitHub(remote, tmp_path / "scratch")


@pytest.fixture
def store():
    return InMemoryRawStore()


@pytest.fixture
def index():
    return InMemoryIndex()


def run(clone, tmp_path, store, fetcher, github, index, writer=None, lines=None, **kwargs):
    sources = load_sources(clone / "6-politics" / "2-sources")
    index_step = kwargs.pop("index_step", None) or (
        lambda chosen, dry_run: [
            index_source(s, store, FakeEmbedder(), index, repo_root=clone, dry_run=dry_run)
            for s in chosen
        ]
    )
    pipeline = Pipeline(
        store,
        fetcher,
        writer or FakeWriter(),
        index_step,
        repo_root=clone,
        staging=lambda slug: tmp_path / "staging" / slug,
        sleep=lambda _: None,
        log=(lines if lines is not None else []).append,
        limit=kwargs.pop("limit", None),
    )
    return daily_run(sources, pipeline, RunnerRepo(Git(clone), github, "main"), NOW, **kwargs)


def on_remote(remote, path: str) -> list[str]:
    return git(remote, "ls-tree", "-r", "--name-only", "main", "--", path).splitlines()


def digests_on_remote(remote) -> list[str]:
    return [p for p in on_remote(remote, CHRONICLE) if not p.endswith("CLAUDE.md")]


DEMO = "https://www.youtube.com/@Demo/videos"
AUTRE = "https://www.youtube.com/@Autre/videos"


def test_a_new_video_becomes_a_digest_on_main_through_one_merged_pull_request(
    tmp_path, remote, clone, github, store, index
):
    fetcher = FakeFetcher({DEMO: ["newvideo001"], AUTRE: []})

    report = run(clone, tmp_path, store, fetcher, github, index)

    assert report.failures == []
    assert store.exists("demo", "newvideo001")
    assert len(report.new_digests) == 1
    assert digests_on_remote(remote) == report.new_digests
    assert len(github.opened) == 1
    base, head, title, body = github.opened[0]
    assert (base, head) == ("main", "wikipol/run-2026-10-31-070000")
    assert title == "wikipol: daily run of 2026-10-31, 1 Digest"
    assert f"new Digest: {report.new_digests[0]}" in body
    assert report.pull_request == "https://github.com/Diplow/diplow/pull/1"
    # The index holds the Publication with its Digest's path: it ran after the filing.
    assert index.indexed("demo")["newvideo001"].digest_path == report.new_digests[0]
    assert git(clone, "status", "--porcelain") == ""
    assert git(clone, "rev-parse", "HEAD") == git(remote, "rev-parse", "main")


def test_a_day_without_a_new_video_opens_no_pull_request(tmp_path, clone, github, store, index):
    fetcher = FakeFetcher({DEMO: ["newvideo001"], AUTRE: []})
    run(clone, tmp_path, store, fetcher, github, index)
    writer, lines = FakeWriter(), []

    report = run(clone, tmp_path, store, fetcher, github, index, writer=writer, lines=lines)

    assert report.failures == [] and report.pull_request is None
    assert len(github.opened) == 1  # the first day's only
    assert writer.digests == [] and writer.periods == 0
    assert fetcher.fetched == ["newvideo001"]
    assert "nothing new: no branch, no pull request" in lines
    assert "nothing new: no pull request" in format_summary(report)


def test_a_failing_index_stops_nothing_else(tmp_path, remote, clone, github, store, index):
    def unreachable(chosen, dry_run):
        raise ConfigError("WIKIPOL_DATABASE_URL is not set, in ~/.config/wikipol/.env")

    fetcher = FakeFetcher({DEMO: ["newvideo001"], AUTRE: []})

    report = run(clone, tmp_path, store, fetcher, github, index, index_step=unreachable)

    assert report.failures == [
        "index: ConfigError: WIKIPOL_DATABASE_URL is not set, in ~/.config/wikipol/.env"
    ]
    assert digests_on_remote(remote) == report.new_digests != []


def test_three_failures_in_a_row_stop_the_fetcher_for_the_sources_after(
    tmp_path, remote, clone, github, store, index
):
    store.put("autre", "oldraw00001", raw("oldraw00001"), RawMeta("ANCIEN", date(2026, 1, 1)))
    fetcher = FakeFetcher(
        {DEMO: ["fail0000001", "fail0000002", "fail0000003"], AUTRE: ["autrevid001"]},
        failing={"fail0000001", "fail0000002", "fail0000003"},
    )

    report = run(clone, tmp_path, store, fetcher, github, index)

    assert fetcher.listed == [DEMO]  # Autre isn't fetched
    assert len([f for f in report.failures if f.startswith("demo fetch")]) == 3
    # Its Raw already in the bucket is digested and published all the same.
    assert [p for p in on_remote(remote, "6-politics/2-sources/2-autre/1-chronicle")] != [
        "6-politics/2-sources/2-autre/1-chronicle/CLAUDE.md"
    ]
    assert report.pull_request is not None


def test_a_source_whose_channel_cant_be_listed_leaves_the_others_running(
    tmp_path, remote, clone, github, store, index
):
    fetcher = FakeFetcher({DEMO: [], AUTRE: ["autrevid001"]}, unlisted={DEMO})

    report = run(clone, tmp_path, store, fetcher, github, index)

    assert report.failures == [
        "demo fetch: FetchFailed: yt-dlp exited with 1: ERROR: Sign in to confirm you're not a bot"
    ]
    assert fetcher.fetched == ["autrevid001"]
    assert report.pull_request is not None


def test_three_failed_digests_stop_the_digests_for_the_sources_after(
    tmp_path, clone, github, store, index
):
    refused = {"newvideo001", "newvideo002", "newvideo003"}
    fetcher = FakeFetcher({DEMO: sorted(refused), AUTRE: ["autrevid001"]})
    writer = FakeWriter(refused=frozenset(refused))

    report = run(clone, tmp_path, store, fetcher, github, index, writer=writer)

    assert set(writer.digests) == refused  # two drafts each; Autre's Raw never goes to the model
    assert "demo digest stopped: 3 failures in a row" in report.failures
    assert store.exists("autre", "autrevid001")  # it was fetched
    assert report.pull_request is None  # nothing was filed


def test_the_limit_caps_videos_fetched_and_raws_digested_per_source(
    tmp_path, clone, github, store, index
):
    fetcher = FakeFetcher({DEMO: ["newvideo001", "newvideo002", "newvideo003"], AUTRE: []})
    writer = FakeWriter()

    run(clone, tmp_path, store, fetcher, github, index, writer=writer, limit=1)

    assert fetcher.fetched == ["newvideo001"]
    assert writer.digests == ["newvideo001"]


def test_a_dry_run_writes_nothing_anywhere(tmp_path, remote, clone, github, store, index):
    fetcher = FakeFetcher({DEMO: ["newvideo001"], AUTRE: []})
    store.put("autre", "oldraw00001", raw("oldraw00001"), RawMeta("ANCIEN", date(2026, 1, 1)))
    git(clone, "config", "--unset", "wikipol.runner")  # a dry run may run in any clone
    writer, lines = FakeWriter(), []
    main_before = git(remote, "rev-parse", "main")

    report = run(
        clone, tmp_path, store, fetcher, github, index, writer=writer, lines=lines, dry_run=True
    )

    assert report.failures == []
    assert fetcher.fetched == [] and writer.digests == []
    assert not store.exists("demo", "newvideo001")
    assert index.indexed("autre") == {}
    assert github.opened == []
    assert git(clone, "status", "--porcelain") == ""
    assert git(remote, "rev-parse", "main") == main_before
    summary = format_summary(report)
    assert "- demo: 1 videos without a Raw; 0 Raws to digest" in summary
    assert "- autre: 0 videos without a Raw; 1 Raws to digest" in summary
    assert "- index: 1 Publications to index" in summary
    assert lines[0].startswith("dry run in ")


def test_a_clone_that_isnt_the_runners_runs_nothing(tmp_path, clone, github, store, index):
    git(clone, "config", "--unset", "wikipol.runner")
    fetcher = FakeFetcher({DEMO: ["newvideo001"], AUTRE: []})

    report = run(clone, tmp_path, store, fetcher, github, index)

    assert fetcher.listed == []
    assert len(report.failures) == 1 and "not the runner's clone" in report.failures[0]


def test_a_failed_publish_is_carried_by_the_next_run(tmp_path, remote, clone, store, index):
    fetcher = FakeFetcher({DEMO: ["newvideo001"], AUTRE: []})
    down = FakeGitHub(remote, tmp_path / "scratch", fail_on="open")

    failed = run(clone, tmp_path, store, fetcher, down, index)

    assert failed.failures[-1].startswith("publish: gh pr create exited with 1")
    assert digests_on_remote(remote) == []
    writer = FakeWriter()

    report = run(clone, tmp_path, store, fetcher, FakeGitHub(remote, tmp_path / "scratch"), index,
                 writer=writer)  # fmt: skip

    assert writer.digests == []  # not written twice
    assert digests_on_remote(remote) == failed.new_digests
    assert f"carried from a stopped run: {failed.new_digests[0]}" in format_summary(report)


def test_the_command_logs_to_a_file_and_stops_on_a_missing_setting(tmp_path, capsys):
    status = cli.main(["run", "--dry-run", "--log-dir", str(tmp_path / "logs")])

    assert status == 2
    (log,) = (tmp_path / "logs").glob("run-*.log")
    assert "WIKIPOL_S3_BUCKET is not set" in log.read_text()

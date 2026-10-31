"""The yt-dlp Fetcher on recorded yt-dlp output: a fake runner plays yt-dlp's part."""

import shutil
import subprocess
from datetime import date
from pathlib import Path

import pytest

from wikipol.fetch.fetcher import FetchFailed
from wikipol.fetch.ytdlp import YtDlpFetcher
from wikipol.raw_store import RawMeta

FIXTURES = Path(__file__).parent / "fixtures" / "fetch"
VIDEO = "ubfvCuQziRA"


class FakeYtDlp:
    """Answers a listing with channel.json, and a fetch by writing the files yt-dlp would."""

    def __init__(self, writes=("info.json", "captions.fr.json3"), returncode=0, stderr=""):
        self.writes, self.returncode, self.stderr = writes, returncode, stderr
        self.commands: list[list[str]] = []

    def __call__(self, command, timeout):
        command = list(command)
        self.commands.append(command)
        stdout = ""
        if "--flat-playlist" in command:
            stdout = (FIXTURES / "channel.json").read_text(encoding="utf-8")
        else:
            folder = Path(command[command.index("--paths") + 1])
            video = command[-1].split("v=")[1]
            for name in self.writes:
                target = name.replace("captions", video).replace("info", f"{video}.info")
                shutil.copy(FIXTURES / name, folder / target)
        return subprocess.CompletedProcess(command, self.returncode, stdout, self.stderr)


def test_the_listing_keeps_the_videos_that_have_captions_to_fetch():
    fetcher = YtDlpFetcher(FakeYtDlp())

    ids = fetcher.list_channel("https://www.youtube.com/@PaduTeam/videos")

    # Newest first, as the channel lists them; no upcoming live, no members-only video.
    assert ids == [VIDEO, "b5CY98TXYZk", "WTrg8i2HfP0"]


def test_a_fetch_builds_the_raw_and_its_metadata():
    fake = FakeYtDlp()

    fetched = YtDlpFetcher(fake).fetch(VIDEO)

    assert fetched.body.decode("utf-8") == (
        f"---\nyoutube_id: {VIDEO}\n---\n"
        "\n0:00\n\nBonjour à tous aujourd'hui on parle du budget\n"
        "\n\n0:31\n\nle gouvernement recule encore une fois\n"
        "\n\n1:02:05\n\nà demain\n"
    )
    assert fetched.meta == RawMeta(
        title="LE BUDGET : LE GOUVERNEMENT RECULE ENCORE !",
        published=date(2026, 10, 29),
        duration=3734,
    )
    command = fake.commands[0]
    assert "--skip-download" in command
    assert command[command.index("--sub-langs") + 1] == "fr"


def test_a_fetch_falls_back_on_webvtt():
    fetched = YtDlpFetcher(FakeYtDlp(writes=("info.json", "captions.fr.vtt"))).fetch(VIDEO)

    assert "\n0:31\n\nle gouvernement recule\n" in fetched.body.decode("utf-8")


def test_a_video_without_french_captions_fails():
    with pytest.raises(FetchFailed, match="no French captions"):
        YtDlpFetcher(FakeYtDlp(writes=("info.json",))).fetch(VIDEO)


def test_a_yt_dlp_error_fails_with_its_last_line():
    fake = FakeYtDlp(writes=(), returncode=1, stderr="WARNING: x\nERROR: Sign in to confirm\n")

    with pytest.raises(FetchFailed, match="exited with 1: ERROR: Sign in to confirm"):
        YtDlpFetcher(fake).fetch(VIDEO)


def test_a_yt_dlp_timeout_fails():
    def hangs(command, timeout):
        raise subprocess.TimeoutExpired(command, timeout)

    with pytest.raises(FetchFailed, match="timed out"):
        YtDlpFetcher(hangs).list_channel("https://www.youtube.com/@PaduTeam/videos")

"""The default Fetcher: yt-dlp, run from the Mac, whose home IP YouTube still serves captions to.

One yt-dlp call lists a channel, one more per video writes its French captions (json3, else
WebVTT) and its info file into a temporary folder: the captions make the Raw, the info file its
title, publication date and duration. Downloads nothing else.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from collections.abc import Callable, Sequence
from datetime import date, datetime
from pathlib import Path
from typing import Any

from wikipol.fetch.captions import build_raw, parse_json3, parse_vtt
from wikipol.fetch.fetcher import Fetched, FetchFailed, watch_url
from wikipol.raw_store import YOUTUBE_ID, RawMeta

CAPTION_LANGUAGE = "fr"
LIST_TIMEOUT_SECONDS = 300
FETCH_TIMEOUT_SECONDS = 120

Run = Callable[[Sequence[str], int], "subprocess.CompletedProcess[str]"]
"""Runs a command with a timeout in seconds, capturing its output as text."""

YT_DLP = (sys.executable, "-m", "yt_dlp", "--no-warnings", "--extractor-args", "youtube:lang=fr")

# A video the channel lists that has no captions to fetch yet, or not for everyone.
UNFETCHABLE_LIVE = {"is_upcoming", "is_live", "post_live"}
UNFETCHABLE_AVAILABILITY = {"premium_only", "subscriber_only", "needs_auth", "private"}


def run_command(command: Sequence[str], timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)


def last_line(text: str) -> str:
    lines = [line for line in text.strip().splitlines() if line.strip()]
    return lines[-1][:300] if lines else "no output"


class YtDlpFetcher:
    def __init__(self, run: Run = run_command) -> None:
        self.run = run

    def _yt_dlp(self, args: Sequence[str], timeout: int) -> str:
        command = [*YT_DLP, *args]
        try:
            result = self.run(command, timeout)
        except subprocess.TimeoutExpired as error:
            raise FetchFailed(f"yt-dlp timed out after {timeout} s") from error
        if result.returncode != 0:
            raise FetchFailed(f"yt-dlp exited with {result.returncode}: {last_line(result.stderr)}")
        return result.stdout

    def list_channel(self, channel_url: str) -> list[str]:
        out = self._yt_dlp(
            ["--flat-playlist", "--dump-single-json", channel_url], LIST_TIMEOUT_SECONDS
        )
        try:
            entries = json.loads(out).get("entries") or []
        except (json.JSONDecodeError, AttributeError) as error:
            raise FetchFailed("yt-dlp listed the channel in a form it can't read") from error
        return [
            str(entry["id"])
            for entry in entries
            if YOUTUBE_ID.fullmatch(str(entry.get("id") or ""))
            and entry.get("live_status") not in UNFETCHABLE_LIVE
            and entry.get("availability") not in UNFETCHABLE_AVAILABILITY
        ]

    def fetch(self, youtube_id: str) -> Fetched:
        with tempfile.TemporaryDirectory(prefix="wikipol-yt-dlp-") as tmp:
            folder = Path(tmp)
            self._yt_dlp(
                [
                    "--skip-download",
                    "--ignore-no-formats-error",
                    "--no-playlist",
                    "--write-info-json",
                    "--write-subs",
                    "--write-auto-subs",
                    "--sub-langs",
                    CAPTION_LANGUAGE,
                    "--sub-format",
                    "json3/vtt",
                    "--paths",
                    str(folder),
                    "--output",
                    "%(id)s.%(ext)s",
                    watch_url(youtube_id),
                ],
                FETCH_TIMEOUT_SECONDS,
            )
            info_path = folder / f"{youtube_id}.info.json"
            json3 = folder / f"{youtube_id}.{CAPTION_LANGUAGE}.json3"
            vtt = folder / f"{youtube_id}.{CAPTION_LANGUAGE}.vtt"
            if not info_path.is_file():
                raise FetchFailed("yt-dlp wrote no info file")
            try:
                info = json.loads(info_path.read_text(encoding="utf-8"))
                if json3.is_file():
                    segments = parse_json3(json3.read_text(encoding="utf-8"))
                elif vtt.is_file():
                    segments = parse_vtt(vtt.read_text(encoding="utf-8"))
                else:
                    raise FetchFailed("no French captions")
            except (ValueError, AttributeError) as error:  # JSON yt-dlp wrote but we can't read
                raise FetchFailed(f"unreadable yt-dlp output: {error}") from error
        if not segments:
            raise FetchFailed("the French captions are empty")
        body = build_raw(youtube_id, segments).encode("utf-8")
        return Fetched(youtube_id, body, meta_from_info(info))


def meta_from_info(info: dict[str, Any]) -> RawMeta:
    upload_date = str(info.get("upload_date") or "")
    published: date | None = None
    if len(upload_date) == 8 and upload_date.isdigit():
        published = datetime.strptime(upload_date, "%Y%m%d").date()
    duration = info.get("duration")
    return RawMeta(
        title=str(info.get("title") or "").strip(),
        published=published,
        duration=round(duration) if isinstance(duration, int | float) else None,
    )

"""The other Fetcher: a third-party transcript API, for a runner without a home IP.

Supadata (https://docs.supadata.ai) fetches from YouTube on its side: `/youtube/channel/videos`
lists a channel, `/metadata` gives a video's title, publication date and duration, and
`/transcript`, in `native` mode, its own captions, never an AI transcription. Its chunks carry
their start in milliseconds, so the Raw is built as the yt-dlp one is. A transcript the API can
only serve later (a 202 and a job id) counts as a failure.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from collections.abc import Callable
from datetime import date, datetime
from typing import Any
from urllib.parse import urlencode

from wikipol.fetch.captions import Segment, build_raw
from wikipol.fetch.fetcher import Fetched, FetchFailed, watch_url
from wikipol.raw_store import YOUTUBE_ID, RawMeta

API_ROOT = "https://api.supadata.ai/v1"
CAPTION_LANGUAGE = "fr"
TIMEOUT_SECONDS = 60
CHANNEL_LIMIT = 5000  # the API's maximum

HttpGet = Callable[[str, dict[str, str]], tuple[int, bytes]]
"""GETs a URL with headers; returns the status and the body, whatever the status."""


def http_get(url: str, headers: dict[str, str]) -> tuple[int, bytes]:
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()
    except (urllib.error.URLError, TimeoutError) as error:
        raise FetchFailed(f"transcript API unreachable: {error}") from error


class TranscriptApiFetcher:
    def __init__(self, api_key: str, get: HttpGet = http_get) -> None:
        self._headers = {"x-api-key": api_key, "Accept": "application/json"}
        self._get = get

    def _call(self, path: str, **params: str | int) -> dict[str, Any]:
        status, body = self._get(f"{API_ROOT}/{path}?{urlencode(params)}", self._headers)
        try:
            payload = json.loads(body) if body else None
        except ValueError:
            payload = None
        if not isinstance(payload, dict):
            payload = None
        if status == 202:
            raise FetchFailed(f"transcript API /{path}: an asynchronous job, not fetched")
        if status != 200:
            reason = (payload or {}).get("error") or "no detail"
            raise FetchFailed(f"transcript API /{path} answered {status}: {reason}")
        if payload is None:
            raise FetchFailed(f"transcript API /{path} answered in a form it can't read")
        return payload

    def list_channel(self, channel_url: str) -> list[str]:
        payload = self._call(
            "youtube/channel/videos", id=channel_url, type="video", limit=CHANNEL_LIMIT
        )
        return [str(i) for i in payload.get("videoIds") or [] if YOUTUBE_ID.fullmatch(str(i))]

    def fetch(self, youtube_id: str) -> Fetched:
        url = watch_url(youtube_id)
        metadata = self._call("metadata", url=url)
        transcript = self._call("transcript", url=url, lang=CAPTION_LANGUAGE, mode="native")
        if transcript.get("lang") != CAPTION_LANGUAGE:
            raise FetchFailed(f"no French transcript (the API offered {transcript.get('lang')})")
        content = transcript.get("content")
        if not isinstance(content, list):
            raise FetchFailed("the transcript API returned no timed chunks")
        try:
            chunks = [(int(c["offset"]), " ".join(str(c["text"]).split())) for c in content]
        except (TypeError, KeyError, ValueError) as error:
            raise FetchFailed(f"a transcript chunk lacks its offset or text: {error}") from error
        segments: list[Segment] = [(start, text) for start, text in chunks if text]
        if not segments:
            raise FetchFailed("the French transcript is empty")
        body = build_raw(youtube_id, segments).encode("utf-8")
        return Fetched(youtube_id, body, meta_from_metadata(metadata))


def meta_from_metadata(metadata: dict[str, Any]) -> RawMeta:
    published: date | None = None
    created = str(metadata.get("createdAt") or "")
    if created:
        try:
            published = datetime.fromisoformat(created.replace("Z", "+00:00")).date()
        except ValueError:
            published = None
    media = metadata.get("media") if isinstance(metadata.get("media"), dict) else {}
    duration = media.get("duration")
    return RawMeta(
        title=str(metadata.get("title") or "").strip(),
        published=published,
        duration=round(duration) if isinstance(duration, int | float) else None,
    )

"""Getting Raws from YouTube: the Fetcher interface, its two implementations, and the run."""

from __future__ import annotations

from wikipol.config import ConfigError, FetcherSettings
from wikipol.fetch.fetcher import Fetched, Fetcher, FetchFailed
from wikipol.fetch.transcript_api import TranscriptApiFetcher
from wikipol.fetch.ytdlp import YtDlpFetcher

__all__ = ["FetchFailed", "Fetched", "Fetcher", "make_fetcher"]


def make_fetcher(settings: FetcherSettings) -> Fetcher:
    if settings.kind == "transcript-api":
        if not settings.transcript_api_key:
            raise ConfigError("the transcript API needs WIKIPOL_TRANSCRIPT_API_KEY")
        return TranscriptApiFetcher(settings.transcript_api_key)
    return YtDlpFetcher()

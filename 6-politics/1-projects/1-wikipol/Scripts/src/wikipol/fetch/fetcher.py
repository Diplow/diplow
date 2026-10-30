"""The Fetcher: what gets Raws from YouTube, whatever does the fetching."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from wikipol.raw_store import RawMeta


class FetchFailed(Exception):
    """One Publication's Raw couldn't be fetched: no French captions, a refusal, a timeout."""


@dataclass(frozen=True)
class Fetched:
    """A Raw as a Fetcher returns it, ready for the store."""

    youtube_id: str
    body: bytes
    meta: RawMeta


class Fetcher(Protocol):
    def list_channel(self, channel_url: str) -> list[str]:
        """The YouTube ids of the channel's videos, newest first. Raises FetchFailed."""
        ...

    def fetch(self, youtube_id: str) -> Fetched:
        """One video's Raw and its metadata. Raises FetchFailed."""
        ...


def watch_url(youtube_id: str) -> str:
    return f"https://www.youtube.com/watch?v={youtube_id}"

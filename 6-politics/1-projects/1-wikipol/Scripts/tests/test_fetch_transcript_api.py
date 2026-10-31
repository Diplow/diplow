"""The transcript-API Fetcher on recorded API answers: a fake GET plays Supadata's part."""

import json
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest

from wikipol.fetch.fetcher import FetchFailed
from wikipol.fetch.transcript_api import TranscriptApiFetcher
from wikipol.raw_store import RawMeta

FIXTURES = Path(__file__).parent / "fixtures" / "fetch"
VIDEO = "ubfvCuQziRA"


class FakeApi:
    def __init__(self, answers=None):
        self.answers = {
            "youtube/channel/videos": (200, "supadata/channel-videos.json"),
            "metadata": (200, "supadata/metadata.json"),
            "transcript": (200, "supadata/transcript.json"),
            **(answers or {}),
        }
        self.requests: list[tuple[str, dict, dict]] = []

    def __call__(self, url, headers):
        parsed = urlparse(url)
        path = parsed.path.removeprefix("/v1/")
        self.requests.append((path, parse_qs(parsed.query), headers))
        status, answer = self.answers[path]
        if isinstance(answer, str) and answer.endswith(".json"):
            return status, (FIXTURES / answer).read_bytes()
        return status, json.dumps(answer).encode()


def test_the_listing_is_the_channels_videos_without_shorts():
    api = FakeApi()

    ids = TranscriptApiFetcher("k", api).list_channel("https://www.youtube.com/@PaduTeam/videos")

    assert ids == [VIDEO, "b5CY98TXYZk", "WTrg8i2HfP0"]
    path, query, headers = api.requests[0]
    assert path == "youtube/channel/videos"
    assert query["type"] == ["video"]
    assert headers["x-api-key"] == "k"


def test_a_fetch_builds_the_raw_as_the_yt_dlp_fetcher_does():
    api = FakeApi()

    fetched = TranscriptApiFetcher("k", api).fetch(VIDEO)

    # The fixture holds the captions of captions.fr.json3, so the Raw is the yt-dlp one.
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
    transcript_query = next(q for p, q, _ in api.requests if p == "transcript")
    assert transcript_query["mode"] == ["native"]
    assert transcript_query["lang"] == ["fr"]


def test_a_transcript_in_another_language_fails():
    api = FakeApi({"transcript": (200, {"content": [], "lang": "en", "availableLangs": ["en"]})})

    with pytest.raises(FetchFailed, match="no French transcript"):
        TranscriptApiFetcher("k", api).fetch(VIDEO)


@pytest.mark.parametrize(
    ("status", "answer", "reason"),
    [
        (206, {"error": "transcript-unavailable", "message": "m", "details": "d"}, "206"),
        (202, {"jobId": "j"}, "asynchronous"),
        (429, {"error": "limit-exceeded", "message": "m", "details": "d"}, "limit-exceeded"),
        (500, "<html>oops</html>", "500: no detail"),
    ],
)
def test_an_api_refusal_fails(status, answer, reason):
    api = FakeApi({"transcript": (status, answer)})

    with pytest.raises(FetchFailed, match=reason):
        TranscriptApiFetcher("k", api).fetch(VIDEO)

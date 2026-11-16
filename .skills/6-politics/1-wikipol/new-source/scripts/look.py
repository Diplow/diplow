"""What YouTube says of a channel, and where it would go among the Sources. See look.sh."""

import json
import re
import statistics
import subprocess
import sys
from pathlib import Path

from wikipol.config import ConfigError, load_settings, load_sources
from wikipol.fetch.ytdlp import LIST_TIMEOUT_SECONDS, YT_DLP

MAX_SOURCES = 6
TITLES = 12


def minutes(seconds: float) -> str:
    return f"{round(seconds / 60)} min"


def main(channel: str, sources_dir: Path) -> int:
    try:
        load_settings()  # the bucket: the steps after this one store and read Raws
    except ConfigError as error:
        print(f"wikipol: {error}", file=sys.stderr)
        return 2
    handle = re.search(r"@[\w.-]+", channel)
    if not handle:
        print(f"{channel!r} names no @handle: give youtube.com/@Handle", file=sys.stderr)
        return 2
    url = f"https://www.youtube.com/{handle.group(0)}/videos"
    listing = subprocess.run(
        [*YT_DLP, "--flat-playlist", "--dump-single-json", url],
        capture_output=True,
        text=True,
        timeout=LIST_TIMEOUT_SECONDS,
        check=False,
    )
    if listing.returncode != 0:
        print(f"yt-dlp could not list {url}: {listing.stderr.strip()[-300:]}", file=sys.stderr)
        return 2
    info = json.loads(listing.stdout)
    videos = [entry for entry in info.get("entries") or [] if entry.get("id")]
    durations = sorted(v["duration"] for v in videos if v.get("duration"))

    print(f"channel: {info.get('channel')}")
    print(f"handle: {info.get('uploader_id') or handle.group(0)}")
    print(f"channel_url: {url}")
    print(f"videos: {len(videos)} on the Videos tab (no Shorts, no past lives)")
    if durations:
        print(
            f"durations: {minutes(durations[0])} to {minutes(durations[-1])}, "
            f"median {minutes(statistics.median(durations))}, "
            f"{round(sum(durations) / 3600)} h in all"
        )
    print("about:")
    for line in (info.get("description") or "(none)").splitlines():
        print(f"  {line}")
    print(f"newest {min(TITLES, len(videos))} titles:")
    for video in videos[:TITLES]:
        print(f"  {video.get('title')} ({minutes(video.get('duration') or 0)})")
    if len(videos) > TITLES:
        print(f"oldest {min(TITLES, len(videos) - TITLES)} titles, oldest last:")
        for video in videos[-TITLES:][-(len(videos) - TITLES) :]:
            print(f"  {video.get('title')} ({minutes(video.get('duration') or 0)})")

    sources = load_sources(sources_dir)
    print(f"sources: {len(sources)} of {MAX_SOURCES}: {', '.join(s.slug for s in sources)}")
    same = [
        s
        for s in sources
        if (found := re.search(r"@[\w.-]+", s.channel_url or ""))
        and found.group(0).lower() == handle.group(0).lower()
    ]
    if same:
        print(
            f"{handle.group(0)} is already the Source {same[0].slug}: {same[0].node}",
            file=sys.stderr,
        )
        return 2
    taken = {int(m.group(1)) for p in sources_dir.iterdir() if (m := re.match(r"(\d+)-", p.name))}
    free = [n for n in range(1, MAX_SOURCES + 1) if n not in taken]
    if not free:
        print(
            f"the Sources node holds {MAX_SOURCES}: regroup them first, as its CLAUDE.md says",
            file=sys.stderr,
        )
        return 2
    print(f"node: {sources_dir.name}/{free[0]}-<slug>")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], Path(sys.argv[2])))

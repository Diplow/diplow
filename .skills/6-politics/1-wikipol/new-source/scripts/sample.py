"""Stores a few Raws spread over a Source's channel and copies them out to read. See sample.sh."""

import sys
import time
from pathlib import Path

from wikipol import fetch
from wikipol.config import load_fetcher_settings, load_settings, load_sources
from wikipol.fetch.fetcher import FetchFailed
from wikipol.fetch.run import PAUSE_SECONDS
from wikipol.raw_store import RawExists, RawNotFound, S3RawStore

NEIGHBOURS = 3  # videos tried around a position whose own video can't be fetched


def main(slug: str, wanted: int, out: Path) -> int:
    source = next(s for s in load_sources() if s.slug == slug)
    store = S3RawStore.from_settings(load_settings())
    fetcher = fetch.make_fetcher(load_fetcher_settings())
    listed = list(dict.fromkeys(fetcher.list_channel(source.channel_url)))
    if not listed:
        print(f"{source.channel_url} lists no video", file=sys.stderr)
        return 2
    wanted = min(wanted, len(listed))
    positions = sorted({round(i * (len(listed) - 1) / max(1, wanted - 1)) for i in range(wanted)})
    fetched = 0
    written = 0
    for position in positions:
        for youtube_id in listed[position : position + NEIGHBOURS]:
            try:
                raw = store.get(slug, youtube_id)
            except RawNotFound:
                if fetched:
                    time.sleep(PAUSE_SECONDS)
                fetched += 1
                try:
                    got = fetcher.fetch(youtube_id)
                    store.put(slug, youtube_id, got.body, got.meta)
                except RawExists:
                    pass
                except FetchFailed as error:  # no captions, a refusal: the next video over
                    print(f"{youtube_id}: {error}", file=sys.stderr)
                    continue
                raw = store.get(slug, youtube_id)
            path = out / f"{youtube_id}.md"
            path.write_bytes(raw.body)
            minutes = f"{round(raw.meta.duration / 60)} min" if raw.meta.duration else "-"
            print(f"{path}\t{raw.meta.published or '-'}\t{minutes}\t{raw.meta.title}", flush=True)
            written += 1
            break
    return 0 if written else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], int(sys.argv[2]), Path(sys.argv[3])))

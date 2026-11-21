"""Stores a few Raws spread over a Source's channel and copies them out to read. See sample.sh."""

import contextlib
import sys
import time
from pathlib import Path

from wikipol import fetch
from wikipol.config import ConfigError, load_fetcher_settings, load_settings, load_sources
from wikipol.fetch.fetcher import FetchFailed
from wikipol.fetch.run import PAUSE_SECONDS
from wikipol.raw_store import RawExists, RawMeta, RawNotFound, S3RawStore

NEIGHBOURS = 3  # videos tried at a position whose own video can't be fetched


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
    fetched = written = 0
    for position in positions:
        # The next videos over, toward the older ones; at the listing's end, toward the newer.
        start = min(position, max(0, len(listed) - NEIGHBOURS))
        candidates = [listed[position], *(v for v in listed[start : start + NEIGHBOURS])]
        for youtube_id in dict.fromkeys(candidates):
            body: bytes
            meta: RawMeta
            try:
                raw = store.get(slug, youtube_id)
                body, meta = raw.body, raw.meta
            except RawNotFound:
                if fetched:
                    time.sleep(PAUSE_SECONDS)
                fetched += 1
                try:
                    got = fetcher.fetch(youtube_id)
                except FetchFailed as error:  # no captions, a refusal: the next video over
                    print(f"{youtube_id}: {error}", file=sys.stderr)
                    continue
                body, meta = got.body, got.meta
                # A video from before the Source's start is read, not kept: every Raw of the
                # bucket gets a Digest, and the Chronicle starts at `youtube.since`.
                older = source.since and meta.published and meta.published < source.since
                if not older:
                    with contextlib.suppress(RawExists):
                        store.put(slug, youtube_id, body, meta)
            path = out / f"{youtube_id}.md"
            path.write_bytes(body)
            minutes = f"{round(meta.duration / 60)} min" if meta.duration else "-"
            print(f"{path}\t{meta.published or '-'}\t{minutes}\t{meta.title}", flush=True)
            written += 1
            break
    return 0 if written else 2


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1], int(sys.argv[2]), Path(sys.argv[3])))
    except (ConfigError, FetchFailed) as error:  # a setting missing, the channel not listed
        print(f"wikipol: {error}", file=sys.stderr)
        sys.exit(2)

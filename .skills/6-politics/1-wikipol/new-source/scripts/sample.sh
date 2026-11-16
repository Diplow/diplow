#!/usr/bin/env bash
# sample.sh SLUG [N]: copies N of the Source's Raws (3 by default: the newest, the oldest and one
# between, of those the bucket dates) into a new temporary folder, one file each, and prints
# `path<TAB>published<TAB>duration<TAB>title` per Raw. For reading before the editorial context
# is written.
. "$(dirname "$0")/../../ingest-source/scripts/lib.sh"
need_slug "${1:-}"
out="$(mktemp -d "${TMPDIR:-/tmp}/wikipol-sample-$1.XXXXXX")"
uv --directory "$SCRIPTS" run --quiet python - "$1" "${2:-3}" "$out" <<'PY'
import sys
from pathlib import Path

from wikipol.config import load_settings
from wikipol.raw_store import S3RawStore

slug, wanted, out = sys.argv[1], int(sys.argv[2]), Path(sys.argv[3])
store = S3RawStore.from_settings(load_settings())
raws = [store.get(slug, youtube_id) for youtube_id in store.list(slug)[:60]]
raws.sort(key=lambda raw: (raw.meta.published is None, raw.meta.published))
if not raws:
    sys.exit(f"the bucket holds no Raw of {slug}: fetch some first")
step = max(1, (len(raws) - 1) // max(1, wanted - 1))
picked = list(dict.fromkeys([*raws[::step][: wanted - 1], raws[-1]]))[:wanted]
for raw in picked:
    path = out / f"{raw.youtube_id}.md"
    path.write_bytes(raw.body)
    minutes = f"{round(raw.meta.duration / 60)} min" if raw.meta.duration else "-"
    print(f"{path}\t{raw.meta.published or '-'}\t{minutes}\t{raw.meta.title}")
PY

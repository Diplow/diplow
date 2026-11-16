#!/usr/bin/env bash
# look.sh CHANNEL: what YouTube says of a channel, before it becomes a Source: its name, handle
# and About text, how many videos its Videos tab lists and how long they run, its newest and
# oldest titles; then the Sources the repo holds and the node the new one would take.
# CHANNEL is a channel URL or an @handle. Exit 2, saying why, when the channel can't be listed,
# is a Source already, or the Sources node is full.
. "$(dirname "$0")/../../ingest-source/scripts/lib.sh"
[ $# -eq 1 ] || { echo "usage: look.sh <channel URL or @handle>" >&2; exit 2; }
command -v uv >/dev/null || { echo "missing: uv is not on PATH" >&2; exit 2; }
uv --directory "$SCRIPTS" run --quiet python "$here/../../new-source/scripts/look.py" "$1" "$SOURCES"

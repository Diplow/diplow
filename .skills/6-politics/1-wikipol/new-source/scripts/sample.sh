#!/usr/bin/env bash
# sample.sh SLUG [N]: stores N Raws of the Source (5 by default) spread evenly over its channel's
# listing, from the newest video to the oldest, and copies them into a new temporary folder, one
# file each. Prints `path<TAB>published<TAB>duration<TAB>title` per Raw. A channel's newest videos
# are often one series: the editorial context is read from its whole history. Takes the machine's
# fetch lock, and pauses between two videos as `wikipol fetch` does. A video published before
# the Source's `youtube.since` is copied out to read and not stored. Exit 2 when it copied none,
# or could not start (a setting, the channel's listing).
. "$(dirname "$0")/../../ingest-source/scripts/lib.sh"
need_slug "${1:-}"
out="$(mktemp -d "${TMPDIR:-/tmp}/wikipol-sample-$1.XXXXXX")"
take_lock "$CACHE/fetch.lock" "$FETCHING"
trap 'rm -rf "$CACHE/fetch.lock"' EXIT
uv --directory "$SCRIPTS" run --quiet python "$here/../../new-source/scripts/sample.py" "$1" "${2:-5}" "$out"

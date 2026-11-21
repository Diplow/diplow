#!/usr/bin/env bash
# lost.sh SLUG YOUTUBE_ID WHY: records a Raw whose agent stopped before recording it: `ok`,
# written and not read, when its Digest is staged all the same, `failed` with WHY otherwise.
. "$(dirname "$0")/lib.sh"
need_slug "${1:-}"
[ $# -eq 3 ] || { echo "usage: lost.sh SLUG YOUTUBE_ID WHY" >&2; exit 2; }
dir="$(state_of "$1")"
if [ -s "$dir/staged/$2.md" ]; then
  "$here/result.sh" "$1" "$2" ok - - - "written, not read: the Raw agent stopped ($3)"
else
  "$here/result.sh" "$1" "$2" failed - - - "the Raw agent stopped: $3"
fi

#!/usr/bin/env bash
# result.sh SLUG YOUTUBE_ID ok|failed PUBLISHED CLAIMS FLAG NOTE: records one Raw's outcome, a
# tab-separated line of the Source's results.tsv, and prints it. `-` for a field with nothing.
. "$(dirname "$0")/lib.sh"
need_slug "${1:-}"
[ $# -eq 7 ] || { echo "usage: result.sh SLUG YOUTUBE_ID ok|failed PUBLISHED CLAIMS FLAG NOTE" >&2; exit 2; }
case "$3" in ok | failed) ;; *) echo "the status is ok or failed, not $3" >&2; exit 2 ;; esac
dir="$(state_of "$1")"

line=""
for field in "$@"; do
  field="$(printf %s "$field" | tr '\t\n\r' '   ')"
  line+="${line:+$'\t'}${field:--}"
done
printf '%s\n' "$line" >>"$dir/results.tsv"
printf '%s\n' "$line"

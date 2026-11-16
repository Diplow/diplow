#!/usr/bin/env bash
# fetch.sh SLUG [wikipol fetch options]: stores the Raws of the Source's videos the bucket lacks,
# newest first, down to `youtube.since` of its source.yaml. One fetch at a time on this machine,
# whatever the session or the checkout: the 8 s pause between two videos assumes a single caller,
# and YouTube bans an IP that asks faster. Prints the report without its `stored:` lines.
# Exit: 0 done, 1 stopped after 3 failures in a row (run it again later), 2 it could not start.
. "$(dirname "$0")/lib.sh"
need_slug "${1:-}"
slug="$1"
shift
dir="$(state_of "$slug")"

take_lock "$CACHE/fetch.lock" "wikipol fetch --source"
trap 'rm -rf "$CACHE/fetch.lock"' EXIT

wikipol fetch --source "$slug" "$@" >"$dir/fetch.out" 2>"$dir/fetch.log"
code=$?
if [ "$code" -ge 2 ] || [ ! -s "$dir/fetch.out" ]; then
  tail -5 "$dir/fetch.log"
  exit 2
fi
grep -v '^  stored: ' "$dir/fetch.out"
exit "$code"

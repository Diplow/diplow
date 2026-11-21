#!/usr/bin/env bash
# index.sh SLUG: puts the Source's Raws the search index lacks in it, and brings the path of every
# Digest the Chronicle moved up to date (`wikipol index`). Prints the report's lines for the Source.
. "$(dirname "$0")/lib.sh"
need_slug "${1:-}"
dir="$(state_of "$1")"
wikipol index --source "$1" 2>"$dir/index.log" | tail -3
code=${PIPESTATUS[0]}
[ "$code" -eq 0 ] || tail -3 "$dir/index.log"
exit "$code"

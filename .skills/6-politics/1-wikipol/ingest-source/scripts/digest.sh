#!/usr/bin/env bash
# digest.sh SLUG YOUTUBE_ID: has `wikipol digest` write and check the Raw's Digest into the
# Source's staging folder, and prints the file's path. Exit: 0 written, 1 rejected twice by the
# checker, 2 it could not run (the bucket, `claude -p` without an answer).
. "$(dirname "$0")/lib.sh"
need_slug "${1:-}"
slug="$1"
id="${2:?usage: digest.sh SLUG YOUTUBE_ID}"
dir="$(state_of "$slug")"

# `--id=`, with the equals sign: a YouTube id can start with `-`.
wikipol digest --source "$slug" --id="$id" --out "$dir/staged/$id.md"
code=$?
[ "$code" -eq 0 ] && echo "staged: $dir/staged/$id.md"
exit "$code"

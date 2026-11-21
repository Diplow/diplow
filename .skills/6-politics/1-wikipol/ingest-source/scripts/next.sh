#!/usr/bin/env bash
# next.sh SLUG: files the Source's staged Digests once there are 6, then claims and prints the
# next YouTube id of the run's queue, `none` when the queue is done, or `STOP: <why>`.
. "$(dirname "$0")/lib.sh"
need_slug "${1:-}"
slug="$1"
dir="$(state_of "$slug")"
[ -e "$dir/queue" ] || { echo "STOP: no queue for $slug, run queue.sh first"; exit 1; }

shopt -s nullglob
staged=("$dir"/staged/*.md)
if [ ${#staged[@]} -ge 6 ]; then
  "$here/file.sh" "$slug" >&2 || { echo "STOP: filing failed, see $dir/file.log"; exit 1; }
fi

# Three failures in a row in this run say something is wrong beyond one Raw: a usage limit, the
# bucket, the skill. Results of earlier runs don't count, nor does a Raw that had failed before
# and fails again at the end of the queue.
offset="$(cat "$dir/run-offset" 2>/dev/null || echo 0)"
fails="$(tail -n +"$((offset + 1))" "$dir/results.tsv" \
  | awk -F'\t' 'FILENAME == ARGV[1] { before[$1] = 1; next } !($2 in before)' "$dir/failed-before" - \
  | tail -3 | awk -F'\t' '$3 != "ok"' | wc -l | tr -d ' ')"
if [ "$fails" -ge 3 ]; then
  echo "STOP: 3 failures in a row for $slug"
  exit 1
fi

id="$(grep -vxFf "$dir/launched" "$dir/queue" | head -1)"
[ -n "$id" ] || { echo none; exit 0; }
printf '%s\n' "$id" >>"$dir/launched"
printf '%s\n' "$id"

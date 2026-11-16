#!/usr/bin/env bash
# status.sh [--flags] SLUG …: where each Source's run stands, one line each, read from its state:
# what the queue still holds, this run's results, what waits in staging. With --flags, then one
# line per Digest this run flagged: `SLUG YOUTUBE_ID FLAG`.
. "$(dirname "$0")/lib.sh"
flags=0
[ "${1:-}" = --flags ] && { flags=1; shift; }
[ $# -ge 1 ] || { echo "usage: status.sh [--flags] SLUG …" >&2; exit 2; }

shopt -s nullglob
for slug in "$@"; do
  need_slug "$slug"
  dir="$(state_of "$slug")"
  [ -e "$dir/queue" ] || { echo "$slug: no run started"; continue; }
  offset="$(cat "$dir/run-offset" 2>/dev/null || echo 0)"
  staged=("$dir"/staged/*.md)
  tail -n +"$((offset + 1))" "$dir/results.tsv" >"$dir/this-run"
  # Claimed, with neither a result nor a staged Digest: its subagent stopped on the way.
  lost=0
  while IFS= read -r id; do
    [ -e "$dir/staged/$id.md" ] || awk -F'\t' -v id="$id" '$2 == id { found = 1 } END { exit !found }' "$dir/this-run" || lost=$((lost + 1))
  done <"$dir/launched"
  echo "$slug: $(grep -cvxFf "$dir/launched" "$dir/queue") left in the queue of $(wc -l <"$dir/queue" | tr -d ' '); this run: $(awk -F'\t' '$3 == "ok"' "$dir/this-run" | wc -l | tr -d ' ') written, $(awk -F'\t' '$3 != "ok"' "$dir/this-run" | wc -l | tr -d ' ') failed, $lost claimed without a result, ${#staged[@]} staged"
done
if [ "$flags" -eq 1 ]; then
  for slug in "$@"; do
    awk -F'\t' '$6 != "-" && $6 != "" { print $1, $2, $6 }' "$STATE/$slug/this-run" 2>/dev/null
  done
fi

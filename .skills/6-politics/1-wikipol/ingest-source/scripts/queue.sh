#!/usr/bin/env bash
# queue.sh SLUG: starts a run for the Source. Lists the Raws without an up-to-date Digest in this
# checkout's Chronicle (`wikipol backfill --dry-run`), oldest first, and writes them as the run's
# queue: a Raw that failed in an earlier run goes last, so three old failures can't stop the run
# before it reaches the new videos. Prints the dry run's first line, then the queue's size.
. "$(dirname "$0")/lib.sh"
need_slug "${1:-}"
slug="$1"
dir="$(state_of "$slug")"
touch "$dir/results.tsv"

if ! wikipol backfill --source "$slug" --dry-run >"$dir/queue.out" 2>"$dir/queue.log"; then
  tail -5 "$dir/queue.log"
  exit 2
fi
sed -n 's/^  would digest: //p' "$dir/queue.out" >"$dir/wanted"

# A staged Digest the Chronicle no longer wants was filed by another run: out of the way.
shopt -s nullglob
for staged in "$dir"/staged/*.md; do
  grep -qxF -- "$(basename "$staged" .md)" "$dir/wanted" || mv "$staged" "$dir/filed/"
done
staged=("$dir"/staged/*.md)

# The latest result of each Raw: the ones that failed are tried again, after the others.
awk -F'\t' '{ last[$2] = $3 } END { for (id in last) if (last[id] != "ok") print id }' \
  "$dir/results.tsv" >"$dir/failed-before"
{
  grep -vxFf "$dir/failed-before" "$dir/wanted"
  grep -xFf "$dir/failed-before" "$dir/wanted"
} 2>/dev/null | while IFS= read -r id; do
  [ -e "$dir/staged/$id.md" ] || printf '%s\n' "$id"
done >"$dir/queue"
: >"$dir/launched"
wc -l <"$dir/results.tsv" | tr -d ' ' >"$dir/run-offset"

sed -n '1s/, oldest first:$//p' "$dir/queue.out"
retried="$(grep -cxFf "$dir/failed-before" "$dir/queue" 2>/dev/null || true)"
echo "$slug: $(wc -l <"$dir/queue" | tr -d ' ') in the queue (${retried:-0} that failed in an earlier run, last), ${#staged[@]} staged and waiting to be filed"

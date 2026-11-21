#!/usr/bin/env bash
# status.sh [--report] SLUG …: where each Source stands, one line each, read from its state: what
# the queue still holds, what this session wrote (since its preflight, across its queues), what
# waits in staging. With --report, also what the final report needs: each Source's last fetch
# and queue lines, its Chronicle's size and dates, the Raws that failed, and one line per Digest
# this session flagged, `flag: SLUG YOUTUBE_ID FLAG`.
. "$(dirname "$0")/lib.sh"
report=0
[ "${1:-}" = --report ] && { report=1; shift; }
[ $# -ge 1 ] || { echo "usage: status.sh [--report] SLUG …" >&2; exit 2; }

shopt -s nullglob
for slug in "$@"; do
  need_slug "$slug"
  dir="$(state_of "$slug")"
  touch "$dir/results.tsv" "$dir/launched"
  offset="$(cat "$dir/session-offset" 2>/dev/null || cat "$dir/run-offset" 2>/dev/null || echo 0)"
  staged=("$dir"/staged/*.md)
  tail -n +"$((offset + 1))" "$dir/results.tsv" >"$dir/this-session"
  if [ -e "$dir/queue" ]; then
    # Claimed, with neither a result nor a staged Digest: its agent stopped on the way.
    lost=0
    while IFS= read -r id; do
      [ -e "$dir/staged/$id.md" ] || awk -F'\t' -v id="$id" '$2 == id { found = 1 } END { exit !found }' "$dir/this-session" || lost=$((lost + 1))
    done <"$dir/launched"
    queue="$(grep -cvxFf "$dir/launched" "$dir/queue") left in the queue of $(wc -l <"$dir/queue" | tr -d ' '), $lost claimed without a result"
  else
    queue="no queue"
  fi
  echo "$slug: $queue; this session: $(awk -F'\t' '$3 == "ok"' "$dir/this-session" | wc -l | tr -d ' ') written, $(awk -F'\t' '$3 != "ok"' "$dir/this-session" | wc -l | tr -d ' ') failed; ${#staged[@]} staged"
  [ "$report" -eq 1 ] || continue
  [ -s "$dir/fetch.out" ] && echo "  fetch: $(sed -n '1p' "$dir/fetch.out")"
  [ -s "$dir/queue.out" ] && echo "  at the last queue: $(sed -n '1s/, oldest first:$//p' "$dir/queue.out")"
  chronicle=("$SOURCES"/*/source.yaml)
  node="$(dirname "$(grep -lE "^  slug: \"?$slug\"?[[:space:]]*(#.*)?$" "${chronicle[@]}")")"
  dates="$(grep -rhs '^published: [0-9]' "$node/1-chronicle" | cut -d' ' -f2 | sort)"
  if [ -n "$dates" ]; then
    echo "  chronicle: $(printf '%s\n' "$dates" | wc -l | tr -d ' ') Digests, $(printf '%s\n' "$dates" | head -1) to $(printf '%s\n' "$dates" | tail -1)"
  else
    echo "  chronicle: empty"
  fi
  awk -F'\t' '{ last[$2] = $0 } END { for (id in last) print last[id] }' "$dir/this-session" \
    | awk -F'\t' '$3 != "ok" { print "  failed: " $1, $2 ": " $7 }'
  awk -F'\t' '$3 == "ok" && $6 != "-" && $6 != "" { print "  flag: " $1, $2 ": " $6 }' "$dir/this-session"
done

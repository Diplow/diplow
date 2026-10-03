#!/usr/bin/env bash
# =============================================================================
# /softeng:ship:run-autonomous-project: wait for the CI of one commit, with a bound.
#
#   bash wait_ci.sh <sha> [--max-wait 540] [--appear 300] [--interval 30] [--repo OWNER/REPO]
#
# The repository defaults to the one `gh repo view` resolves from the working
# directory. Pass --repo to wait on another.
#
# Why not `gh pr checks --watch`: it returns as soon as the checks it can see
# have reported, and a workflow that is still queued is not visible yet. A run
# attached to the head commit is the only reliable signal, so this polls
# `gh run list --commit <sha>` and only calls the result settled after two
# consecutive polls, a minute apart, show the same set of completed runs.
#
# One call never blocks longer than --max-wait seconds (default 540, under the
# ten-minute ceiling most harnesses put on a shell call). The caller re-invokes
# on exit 4 until its own budget is spent.
#
# Last line of stdout, always:  CI=green | CI=red | CI=none | CI=pending
# Exit codes:                   0 green   1 red    3 none    4 pending   2 usage
#
#   green    every run completed with success, skipped or neutral
#   red      at least one run completed otherwise; failed runs are listed as
#            `FAILED <run-id> <workflow> <conclusion>` lines
#   none     no run appeared within --appear seconds. Either the repository has
#            no workflow for this change, or the pull request conflicts with its
#            base (a conflicting pull request runs no CI at all), so the caller
#            checks mergeability before trusting this
#   pending  --max-wait elapsed with runs still queued or in progress
# =============================================================================
set -euo pipefail

usage() { echo "usage: wait_ci.sh <sha> [--max-wait SEC] [--appear SEC] [--interval SEC] [--repo OWNER/REPO]"; exit 2; }

SHA="${1:-}"; shift || true
[[ "$SHA" =~ ^[0-9a-f]{7,40}$ ]] || usage

MAX_WAIT=540 APPEAR=300 INTERVAL=30 REPO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --max-wait) MAX_WAIT="${2:-}"; shift 2 ;;
    --appear)   APPEAR="${2:-}"; shift 2 ;;
    --interval) INTERVAL="${2:-}"; shift 2 ;;
    --repo)     REPO="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done

[ -n "$REPO" ] || REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

# One line per run: "<id>\t<status>\t<conclusion>\t<workflow>"
snapshot() {
  gh run list --repo "$REPO" --commit "$SHA" --limit 100 \
    --json databaseId,status,conclusion,workflowName \
    --jq '.[] | [.databaseId, .status, (.conclusion // ""), .workflowName] | @tsv' | sort
}

verdict() {
  local runs="$1" failed
  failed="$(awk -F'\t' '$3 != "success" && $3 != "skipped" && $3 != "neutral" {print "FAILED " $1 " " $4 " " $3}' <<< "$runs")"
  echo "$runs"
  if [ -n "$failed" ]; then echo "$failed"; echo "CI=red"; exit 1; fi
  echo "CI=green"; exit 0
}

start="$(date +%s)"
while :; do
  elapsed=$(( $(date +%s) - start ))
  runs="$(snapshot || true)"

  if [ -z "$runs" ]; then
    if [ "$elapsed" -ge "$APPEAR" ]; then echo "CI=none"; exit 3; fi
  elif ! awk -F'\t' '$2 != "completed" {found=1} END {exit !found}' <<< "$runs"; then
    # Everything visible has completed. Look once more a minute later: a
    # workflow queued behind the others shows up late, and a re-run resets one.
    sleep 60
    again="$(snapshot || true)"
    if [ "$again" = "$runs" ]; then verdict "$runs"; fi
    continue
  fi

  if [ "$elapsed" -ge "$MAX_WAIT" ]; then
    [ -n "$runs" ] && echo "$runs"
    echo "CI=pending"; exit 4
  fi
  sleep "$INTERVAL"
done

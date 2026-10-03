#!/usr/bin/env bash
# =============================================================================
# /softeng:ship:run-autonomous-project: wait, with a bound, until every automated reviewer
# named in the run config has reported on one pull-request head.
#
#   bash wait_reviews.sh <pr-number> <head-sha> <name,name,...> \
#        [--clean-marker TEXT] [--max-wait 540] [--interval 30] [--repo OWNER/REPO]
#
# The repository defaults to the one `gh repo view` resolves from the working
# directory. Pass --repo to wait on another.
#
# Why a green check is not enough: an app reviewer can set its commit status to
# success without posting a review, because it skipped the pull request or hit
# a rate limit. So each reviewer is matched against what it actually left
# behind, not against its check.
#
# The config names reviewers loosely ("maintainability-review", "domain-design"),
# so matching uses the first hyphen-separated word of each name, lowercased
# ("maintainability", "domain"), as a substring of:
#
#   ran:<conclusion>  a workflow run on <head-sha> whose workflow name contains
#                     the word has completed. The workflow posts its own review
#                     or comment as part of the run.
#   reviewed          a pull-request review by an author whose login contains
#                     the word, submitted on <head-sha>.
#   reviewed:clean    only with --clean-marker: no pull-request review, but an
#                     issue comment by such an author that contains TEXT and
#                     names <head-sha>. Some app reviewers report a review with
#                     zero findings this way, and only this way.
#   commented         only an issue comment by such an author, updated after
#                     the head commit was made. A summary or a "skipped" notice,
#                     not a review.
#   missing           none of the above.
#
# Stdout: one `REVIEW <name> <state>` line per reviewer, then the last line
#   REVIEWS=reported   every reviewer is `ran:*` or `reviewed*`           exit 0
#   REVIEWS=pending    --max-wait elapsed with one `commented`/`missing`  exit 4
# Usage error: exit 2. The caller decides what a pending reviewer means once
# its own budget is spent (see references/pr-loop.md).
# =============================================================================
set -euo pipefail

usage() { echo "usage: wait_reviews.sh <pr-number> <head-sha> <name,name,...> [--clean-marker TEXT] [--max-wait SEC] [--interval SEC] [--repo OWNER/REPO]"; exit 2; }

PR="${1:-}"; SHA="${2:-}"; NAMES="${3:-}"
[[ "$PR" =~ ^[0-9]+$ && "$SHA" =~ ^[0-9a-f]{40}$ && -n "$NAMES" ]] || usage
shift 3

MAX_WAIT=540 INTERVAL=30 REPO="" CLEAN_MARKER=""
while [ $# -gt 0 ]; do
  case "$1" in
    --clean-marker) CLEAN_MARKER="${2:-}"; shift 2 ;;
    --max-wait)     MAX_WAIT="${2:-}"; shift 2 ;;
    --interval)     INTERVAL="${2:-}"; shift 2 ;;
    --repo)         REPO="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done

[ -n "$REPO" ] || REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
MARKER_LC="$(printf '%s' "$CLEAN_MARKER" | tr '[:upper:]' '[:lower:]')"

COMMIT_DATE="$(gh api "repos/${REPO}/commits/${SHA}" --jq '.commit.committer.date')"

count() { awk '{s+=$1} END {print s+0}'; }

state_of() {
  local word="$1" hit
  hit="$(gh run list --repo "$REPO" --commit "$SHA" --limit 100 \
    --json status,conclusion,workflowName \
    --jq "[.[] | select(.status == \"completed\") | select(.workflowName | ascii_downcase | contains(\"${word}\"))][0].conclusion // empty")"
  if [ -n "$hit" ]; then echo "ran:${hit}"; return; fi

  hit="$(gh api "repos/${REPO}/pulls/${PR}/reviews" --paginate \
    --jq "[.[] | select(.commit_id == \"${SHA}\") | select(.user.login | ascii_downcase | contains(\"${word}\"))] | length")"
  if [ "$(count <<< "$hit")" -gt 0 ]; then echo "reviewed"; return; fi

  # A review that found nothing: some reviewers submit no pull-request review
  # and only edit their summary comment to say so, naming the head reviewed.
  if [ -n "$MARKER_LC" ]; then
    hit="$(gh api "repos/${REPO}/issues/${PR}/comments" --paginate \
      --jq "[.[] | select(.updated_at >= \"${COMMIT_DATE}\") | select(.user.login | ascii_downcase | contains(\"${word}\")) | select(.body | ascii_downcase | contains(\"${MARKER_LC}\")) | select(.body | contains(\"${SHA}\"))] | length")"
    if [ "$(count <<< "$hit")" -gt 0 ]; then echo "reviewed:clean"; return; fi
  fi

  hit="$(gh api "repos/${REPO}/issues/${PR}/comments" --paginate \
    --jq "[.[] | select(.updated_at >= \"${COMMIT_DATE}\") | select(.user.login | ascii_downcase | contains(\"${word}\"))] | length")"
  if [ "$(count <<< "$hit")" -gt 0 ]; then echo "commented"; return; fi

  echo "missing"
}

start="$(date +%s)"
while :; do
  report="" pending=0
  IFS=',' read -r -a names <<< "$NAMES"
  for name in "${names[@]}"; do
    name="$(echo "$name" | tr -d '[:space:]')"
    [ -n "$name" ] || continue
    word="$(echo "${name%%-*}" | tr '[:upper:]' '[:lower:]')"
    state="$(state_of "$word")"
    report+="REVIEW ${name} ${state}"$'\n'
    case "$state" in ran:*|reviewed|reviewed:clean) ;; *) pending=1 ;; esac
  done

  if [ "$pending" -eq 0 ]; then printf '%s' "$report"; echo "REVIEWS=reported"; exit 0; fi
  if [ $(( $(date +%s) - start )) -ge "$MAX_WAIT" ]; then
    printf '%s' "$report"; echo "REVIEWS=pending"; exit 4
  fi
  sleep "$INTERVAL"
done

#!/usr/bin/env bash
# =============================================================================
# /do-ticket: deterministic branch mechanics.
#
#   bash start_ticket.sh HEX-123 --type feat --slug "oauth-scopes" \
#        [--repo DIR] [--worktrees-dir DIR]
#
# Names the work branch {type}/hex-{123}-{slug}, based on origin/main, and
# prints the directory to work in on the last line (WORKTREE=...).
#
# Inside a Conductor workspace (CONDUCTOR_WORKSPACE_PATH set) it never creates
# a worktree: the workspace already is one, tracked by its branch name. It
# renames the workspace's branch in place and, when HEAD is behind
# origin/main, fast-forwards it there. --repo and --worktrees-dir are ignored.
#
# Outside Conductor it creates the branch off origin/main in a dedicated git
# worktree (default <repo-parent>/worktrees/hex-{num}-{slug}).
#
# Idempotent: re-run safely after an interruption. An existing branch or
# worktree is reused.
# =============================================================================
set -euo pipefail

TYPES="feat fix refactor docs chore"
BASE="main"

usage() {
  echo "usage: start_ticket.sh HEX-<n> --type {${TYPES// /|}} --slug <short-slug> [--repo DIR] [--worktrees-dir DIR]" >&2
  exit 2
}

KEY="${1:-}"; shift || true
[[ "$KEY" =~ ^[Hh][Ee][Xx]-[0-9]+$ ]] || usage
NUM="${KEY#*-}"

TYPE="" SLUG="" REPO="" WT_DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --type) [ $# -ge 2 ] || usage; TYPE="$2"; shift 2 ;;
    --slug) [ $# -ge 2 ] || usage; SLUG="$2"; shift 2 ;;
    --repo) [ $# -ge 2 ] || usage; REPO="$2"; shift 2 ;;
    --worktrees-dir) [ $# -ge 2 ] || usage; WT_DIR="$2"; shift 2 ;;
    *) usage ;;
  esac
done

case "$TYPE" in
  feat|fix|refactor|docs|chore) ;;
  *) echo "ERROR: --type must be one of: $TYPES" >&2; exit 2 ;;
esac
[ -n "$SLUG" ] || usage

# slug hygiene: lowercase, alnum + dashes only, trimmed
SLUG="$(echo "$SLUG" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g' | cut -c1-40 | sed -E 's/-+$//')"
[ -n "$SLUG" ] || { echo "ERROR: slug empty after sanitizing" >&2; exit 2; }

BRANCH="${TYPE}/hex-${NUM}-${SLUG}"

# --- Conductor mode ----------------------------------------------------------
# The workspace already IS a dedicated worktree (the app created it and tracks
# it by branch name). A nested worktree would hide the work from Conductor, so
# rename the branch in place instead.
if [ -n "${CONDUCTOR_WORKSPACE_PATH:-}" ]; then
  WS="$CONDUCTOR_WORKSPACE_PATH"
  CUR="$(git -C "$WS" branch --show-current)"
  echo "conductor workspace: $WS  (branch: $CUR)"
  git -C "$WS" fetch origin "$BASE" --quiet

  if [ "$CUR" != "$BRANCH" ]; then
    if git -C "$WS" show-ref --verify --quiet "refs/heads/$BRANCH"; then
      echo "ERROR: branch $BRANCH already exists outside this workspace." >&2
      echo "Open it in its own Conductor workspace (new workspace, Branches tab) instead." >&2
      exit 1
    fi
    git -C "$WS" branch -m "$BRANCH"
    echo "renamed branch: $CUR -> $BRANCH"
  fi

  # Base the branch on origin/main. Only a fast-forward: it never drops a
  # commit, and git refuses it if it would overwrite local changes.
  if git -C "$WS" merge-base --is-ancestor HEAD "origin/$BASE"; then
    if git -C "$WS" merge --ff-only --quiet "origin/$BASE"; then
      echo "branch at origin/$BASE"
    else
      echo "NOTE: could not fast-forward onto origin/$BASE (local changes in the way). HEAD left as is."
    fi
  else
    echo "NOTE: branch has commits of its own not on origin/$BASE. HEAD left as is."
  fi

  echo "WORKTREE=$WS"
  exit 0
fi

# --- Worktree mode (outside Conductor) ----------------------------------------
if [ -z "$REPO" ]; then
  REPO="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
[ -n "$REPO" ] && git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1 \
  || { echo "ERROR: not in a git repo (run from the repo or pass --repo)" >&2; exit 1; }

WT_DIR="${WT_DIR:-$(dirname "$REPO")/worktrees}"
DEST="$WT_DIR/hex-${NUM}-${SLUG}"

echo "repo:    $REPO"
echo "branch:  $BRANCH  (from origin/$BASE)"
echo "dest:    $DEST"

# already have this worktree? just report it.
if git -C "$REPO" worktree list --porcelain | grep -qx "worktree $DEST"; then
  echo "worktree already exists, reusing it."
  echo "WORKTREE=$DEST"
  exit 0
fi

mkdir -p "$WT_DIR"
git -C "$REPO" fetch origin "$BASE" --quiet

if git -C "$REPO" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "branch already exists, attaching a worktree to it."
  git -C "$REPO" worktree add "$DEST" "$BRANCH"
else
  git -C "$REPO" worktree add -b "$BRANCH" "$DEST" "origin/$BASE"
fi

echo "WORKTREE=$DEST"

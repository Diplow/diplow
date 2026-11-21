#!/usr/bin/env bash
# file.sh SLUG: files the Source's staged Digests in its Chronicle (`wikipol file`, which has
# write-period summarize every Period touched), then commits what moved on the current branch.
# One filing at a time in this checkout: each commit takes all of 6-politics, and two Sources'
# batches file side by side. Exit: 0 filed or nothing staged, 1 the filing or its commit failed.
. "$(dirname "$0")/lib.sh"
need_slug "${1:-}"
slug="$1"
dir="$(state_of "$slug")"

# commit_chronicle N: commits what a filing of N Digests changed. A commit that fails leaves a
# marker, so the next call commits before it does anything else: the Digests are in the
# Chronicle by then, and no longer staged.
commit_chronicle() {
  local count="$1" message
  cd "$REPO" || return 1
  git add -A 6-politics
  if git diff --cached --quiet; then
    rm -f "$dir/uncommitted"
    echo "$slug: filed $count, nothing new to commit"
    return 0
  fi
  # transcrypt's hook calls nproc, which macOS lacks: without it the commit fails without a word.
  if ! command -v nproc >/dev/null; then
    shim="$(mktemp -d)"
    printf '#!/bin/sh\nsysctl -n hw.ncpu\n' >"$shim/nproc"
    chmod +x "$shim/nproc"
    PATH="$shim:$PATH"
  fi
  message="feat(wikipol): file $count $slug Digests in the Chronicle"
  if [ -s "$dir/commit-trailer" ]; then message+=$'\n\n'"$(cat "$dir/commit-trailer")"; fi
  # A commit can lose a race for .git/index.lock with another git process: three tries.
  for _ in 1 2 3; do
    if git commit -q -m "$message" >>"$dir/file.log" 2>&1; then
      rm -f "$dir/uncommitted"
      echo "$slug: filed $count, $(git log -1 --format=%h)"
      return 0
    fi
    if git diff --cached --quiet; then
      rm -f "$dir/uncommitted"
      echo "$slug: filed $count, already committed"
      return 0
    fi
    sleep 10
  done
  echo "$count" >"$dir/uncommitted"
  echo "$slug: COMMIT FAILED ($count placed in the Chronicle, uncommitted), see $dir/file.log; run file.sh again"
  return 1
}

branch="$(git -C "$REPO" branch --show-current)"
if [ -z "$branch" ] || [ "$branch" = "$(default_branch)" ]; then
  echo "$slug: NOT FILED, on '${branch:-a detached HEAD}': create a working branch first"
  exit 1
fi

take_lock "$STATE/.file.lock" "wikipol file --source"
trap 'rm -rf "$STATE/.file.lock"' EXIT

if [ -e "$dir/uncommitted" ]; then
  commit_chronicle "$(cat "$dir/uncommitted")" || exit 1
fi
shopt -s nullglob
files=("$dir"/staged/*.md)
[ ${#files[@]} -gt 0 ] || { echo "$slug: nothing staged"; exit 0; }

if ! wikipol file --source "$slug" "${files[@]}" >"$dir/file.log" 2>&1; then
  echo "$slug: FILING FAILED (${#files[@]} staged, the Chronicle is unchanged), see $dir/file.log"
  tail -5 "$dir/file.log"
  exit 1
fi
mv "${files[@]}" "$dir/filed/"
commit_chronicle "${#files[@]}"

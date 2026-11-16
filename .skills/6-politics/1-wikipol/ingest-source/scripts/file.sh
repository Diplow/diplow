#!/usr/bin/env bash
# file.sh SLUG: files the Source's staged Digests in its Chronicle (`wikipol file`, which has
# write-period summarize every Period touched), then commits what moved on the current branch.
# One filing at a time in this checkout: each commit takes all of 6-politics, and two Sources'
# batches file side by side. Exit: 0 filed or nothing staged, 1 the filing or its commit failed.
. "$(dirname "$0")/lib.sh"
need_slug "${1:-}"
slug="$1"
dir="$(state_of "$slug")"

shopt -s nullglob
files=("$dir"/staged/*.md)
[ ${#files[@]} -gt 0 ] || { echo "$slug: nothing staged"; exit 0; }
branch="$(git -C "$REPO" branch --show-current)"
if [ -z "$branch" ] || [ "$branch" = "$(default_branch)" ]; then
  echo "$slug: NOT FILED, on '${branch:-a detached HEAD}': create a working branch first"
  exit 1
fi

take_lock "$STATE/.file.lock" "wikipol file --source"
trap 'rm -rf "$STATE/.file.lock"' EXIT
files=("$dir"/staged/*.md) # as they are now that the lock is ours
[ ${#files[@]} -gt 0 ] || { echo "$slug: nothing staged"; exit 0; }

if ! wikipol file --source "$slug" "${files[@]}" >"$dir/file.log" 2>&1; then
  echo "$slug: FILING FAILED (${#files[@]} staged, the Chronicle is unchanged), see $dir/file.log"
  tail -5 "$dir/file.log"
  exit 1
fi
mv "${files[@]}" "$dir/filed/"

cd "$REPO" || exit 1
git add -A 6-politics
git diff --cached --quiet && { echo "$slug: filed ${#files[@]}, nothing new to commit"; exit 0; }
# transcrypt's hook calls nproc, which macOS lacks: without it the commit fails without a word.
if ! command -v nproc >/dev/null; then
  shim="$(mktemp -d)"
  printf '#!/bin/sh\nsysctl -n hw.ncpu\n' >"$shim/nproc"
  chmod +x "$shim/nproc"
  PATH="$shim:$PATH"
fi
message="feat(wikipol): file ${#files[@]} $slug Digests in the Chronicle"
if [ -s "$dir/commit-trailer" ]; then message+=$'\n\n'"$(cat "$dir/commit-trailer")"; fi
# A commit can lose a race for .git/index.lock with another git process: three tries.
for _ in 1 2 3; do
  if git commit -q -m "$message" >>"$dir/file.log" 2>&1; then
    echo "$slug: filed ${#files[@]}, $(git log -1 --format=%h)"
    exit 0
  fi
  git diff --cached --quiet && { echo "$slug: filed ${#files[@]}, already committed"; exit 0; }
  sleep 10
done
echo "$slug: COMMIT FAILED (${#files[@]} placed in the Chronicle, uncommitted), see $dir/file.log"
exit 1

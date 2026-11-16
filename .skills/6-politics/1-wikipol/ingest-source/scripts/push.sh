#!/usr/bin/env bash
# push.sh: pushes the current branch to origin, never the default one. Goes through gh's
# credential helper, whose token may push anything in the repo (workflows included), where the
# keychain's may not.
. "$(dirname "$0")/lib.sh"
branch="$(git -C "$REPO" branch --show-current)"
if [ -z "$branch" ] || [ "$branch" = "$(default_branch)" ]; then
  echo "not pushed: on '${branch:-a detached HEAD}'"
  exit 1
fi
if gh auth status >/dev/null 2>&1; then
  git -C "$REPO" -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -q -u origin HEAD
else
  git -C "$REPO" push -q -u origin HEAD
fi && echo "pushed $branch at $(git -C "$REPO" log -1 --format=%h)"

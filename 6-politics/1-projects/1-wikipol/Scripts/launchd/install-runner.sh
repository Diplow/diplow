#!/usr/bin/env bash
# Sets up wikipol's daily run on this Mac, for the logged-in user:
#   1. a dedicated clone of the repo in ~/wikipol-runner, never the Obsidian folder, marked as the
#      runner's (git config wikipol.runner true: `wikipol run` refuses any other clone);
#   2. the pipeline's virtualenv in it (uv sync --frozen);
#   3. the launchd agent com.diplow.wikipol.runner, from the plist template beside this script,
#      in ~/Library/LaunchAgents, loaded with launchctl bootstrap: `wikipol run` every day at
#      07:00, or at the next wake when the Mac slept through it.
# Run again, it fast-forwards the clone and reloads the agent. uninstall-runner.sh undoes step 3.
#
#   install-runner.sh [--dry-run] [--base <branch>]
#
#   --dry-run   print each command instead of running it; write the filled plist to a temporary
#               file and check it, and nothing else
#   --base      the branch the clone follows and the runs land on (default: main)
#
# WIKIPOL_RUNNER_DIR, WIKIPOL_LAUNCH_AGENTS_DIR and WIKIPOL_RUNNER_REPO override the clone's
# folder, the LaunchAgents folder and the repo's URL (default: this clone's origin).
set -euo pipefail

LABEL=com.diplow.wikipol.runner
SCRIPTS=6-politics/1-projects/1-wikipol/Scripts
HERE=$(cd "$(dirname "$0")" && pwd)
TEMPLATE="$HERE/$LABEL.plist"
RUNNER_DIR=${WIKIPOL_RUNNER_DIR:-$HOME/wikipol-runner}
AGENTS_DIR=${WIKIPOL_LAUNCH_AGENTS_DIR:-$HOME/Library/LaunchAgents}
LOG_DIR="$HOME/Library/Logs/wikipol"
DRY_RUN=0
BASE=main

usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
	case "$1" in
	--dry-run) DRY_RUN=1 ;;
	--base)
		[ $# -ge 2 ] || { usage >&2; exit 2; }
		BASE=$2
		shift
		;;
	-h | --help) usage; exit 0 ;;
	*) usage >&2; exit 2 ;;
	esac
	shift
done

say() { printf 'install-runner: %s\n' "$*"; }
fail() { printf 'install-runner: %s\n' "$*" >&2; exit 1; }
run() {
	if [ "$DRY_RUN" = 1 ]; then
		printf '+ %s\n' "$*"
	else
		"$@"
	fi
}

for tool in git gh uv claude; do
	command -v "$tool" >/dev/null || fail "$tool is not on PATH"
done
REPO_URL=${WIKIPOL_RUNNER_REPO:-$(git -C "$HERE" remote get-url origin)}

# 1. The clone: never this repo, nor a worktree of it, where a human works.
if [ -e "$RUNNER_DIR/.git" ]; then
	here_git=$(cd "$(git -C "$HERE" rev-parse --git-common-dir)" && pwd -P)
	runner_git=$(cd "$RUNNER_DIR" && cd "$(git rev-parse --git-common-dir)" && pwd -P)
	[ "$here_git" != "$runner_git" ] || fail "$RUNNER_DIR is this repo or one of its worktrees, not a clone of its own"
fi
if [ -d "$RUNNER_DIR/.git" ]; then
	origin=$(git -C "$RUNNER_DIR" remote get-url origin)
	[ "$origin" = "$REPO_URL" ] || fail "$RUNNER_DIR is a clone of $origin, not $REPO_URL"
	branch=$(git -C "$RUNNER_DIR" rev-parse --abbrev-ref HEAD)
	case "$branch" in
	wikipol/run-*)
		# A run killed while publishing: the next run takes its files back (or sees it merged).
		say "$RUNNER_DIR is on $branch, a run that stopped while publishing; the next run recovers it"
		;;
	*)
		say "$RUNNER_DIR exists: fast-forwarding it to origin/$BASE"
		run git -C "$RUNNER_DIR" fetch origin
		run git -C "$RUNNER_DIR" switch "$BASE"
		run git -C "$RUNNER_DIR" merge --ff-only "origin/$BASE"
		;;
	esac
elif [ -e "$RUNNER_DIR" ]; then
	fail "$RUNNER_DIR exists and is not a clone"
else
	say "cloning $REPO_URL into $RUNNER_DIR"
	run git clone --branch "$BASE" "$REPO_URL" "$RUNNER_DIR"
fi
run git -C "$RUNNER_DIR" config wikipol.runner true

# 2. The virtualenv.
run uv --directory "$RUNNER_DIR/$SCRIPTS" sync --frozen

# 3. The launchd agent. launchd starts it with a bare PATH: give it the folders of the tools the
# run calls, as this shell finds them.
path=""
for tool in uv gh claude git; do
	dir=$(dirname "$(command -v "$tool")")
	case ":$path:" in *":$dir:"*) ;; *) path="${path:+$path:}$dir" ;; esac
done
path="$path:/usr/bin:/bin:/usr/sbin:/sbin"
rendered=$(mktemp "${TMPDIR:-/tmp}/$LABEL.XXXXXX")
# A value as sed's replacement, then as plist text: \ & | for sed, & < > for XML.
fill() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/[\\&|]/\\&/g'; }
sed -e "s|@UV@|$(fill "$(command -v uv)")|g" -e "s|@RUNNER_DIR@|$(fill "$RUNNER_DIR")|g" \
	-e "s|@HOME@|$(fill "$HOME")|g" -e "s|@PATH@|$(fill "$path")|g" -e "s|@BASE@|$(fill "$BASE")|g" \
	"$TEMPLATE" >"$rendered"
if command -v plutil >/dev/null; then
	plutil -lint "$rendered" >/dev/null || fail "the filled plist doesn't lint: $rendered"
fi
if [ "$DRY_RUN" = 1 ]; then
	say "filled plist: $rendered"
fi

# launchd's runs read their settings from the default env file only (the plist sets no
# WIKIPOL_ENV): say what a run would stop on.
env_file="$HOME/.config/wikipol/.env"
if [ ! -f "$env_file" ]; then
	say "warning: $env_file is missing; every run will stop on it"
else
	for name in WIKIPOL_S3_BUCKET WIKIPOL_S3_ENDPOINT SCW_ACCESS_KEY SCW_SECRET_KEY; do
		grep -q "^$name=." "$env_file" || say "warning: $env_file sets no $name; every run will stop on it"
	done
fi

agent="$AGENTS_DIR/$LABEL.plist"
domain="gui/$(id -u)"
run mkdir -p "$AGENTS_DIR" "$LOG_DIR"
if [ "$DRY_RUN" = 1 ]; then
	printf '+ %s\n' "launchctl bootout $domain/$LABEL (when loaded)"
else
	launchctl bootout "$domain/$LABEL" 2>/dev/null || true
fi
run cp "$rendered" "$agent"
if [ "$DRY_RUN" = 1 ]; then
	printf '+ %s\n' "launchctl bootstrap $domain $agent"
else
	# bootout may return before the agent is gone, and bootstrap then fails: try a few times.
	for attempt in 1 2 3 4 5; do
		error=$(launchctl bootstrap "$domain" "$agent" 2>&1) && break
		[ "$attempt" = 5 ] && { rm -f "$rendered"; fail "launchctl bootstrap $domain $agent failed: $error"; }
		sleep 1
	done
fi
if [ "$DRY_RUN" = 1 ]; then
	say "dry run: nothing was cloned, synced, copied or loaded"
	exit 0
fi
rm -f "$rendered"
say "done: $LABEL runs every day at 07:00; logs in $LOG_DIR"
say "a run now: launchctl kickstart $domain/$LABEL"

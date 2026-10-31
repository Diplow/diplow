#!/usr/bin/env bash
# Stops wikipol's daily run: unloads the launchd agent com.diplow.wikipol.runner and deletes its
# plist from ~/Library/LaunchAgents. Leaves the runner's clone (~/wikipol-runner), whose working
# tree may hold the files of a run that couldn't publish, and the logs (~/Library/Logs/wikipol).
#
#   uninstall-runner.sh [--dry-run]
#
#   --dry-run   print each command instead of running it
#
# WIKIPOL_LAUNCH_AGENTS_DIR overrides the LaunchAgents folder.
set -euo pipefail

LABEL=com.diplow.wikipol.runner
AGENTS_DIR=${WIKIPOL_LAUNCH_AGENTS_DIR:-$HOME/Library/LaunchAgents}
DRY_RUN=0

usage() { sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
	case "$1" in
	--dry-run) DRY_RUN=1 ;;
	-h | --help) usage; exit 0 ;;
	*) usage >&2; exit 2 ;;
	esac
	shift
done

domain="gui/$(id -u)"
agent="$AGENTS_DIR/$LABEL.plist"
if [ "$DRY_RUN" = 1 ]; then
	printf '+ %s\n' "launchctl bootout $domain/$LABEL (when loaded)" "rm -f $agent"
	printf 'uninstall-runner: dry run: nothing was unloaded or deleted\n'
	exit 0
fi
# Not loaded is fine; loaded and refusing to unload is not: the plist stays, for a second try.
if launchctl print "$domain/$LABEL" >/dev/null 2>&1; then
	error=$(launchctl bootout "$domain/$LABEL" 2>&1) ||
		{ printf 'uninstall-runner: launchctl bootout failed: %s\n' "$error" >&2; exit 1; }
fi
rm -f "$agent"
printf 'uninstall-runner: %s unloaded; the clone and the logs stay\n' "$LABEL"

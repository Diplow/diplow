#!/usr/bin/env bash
# preflight.sh SLUG …: what an ingestion relies on, checked before anything is fetched or written.
# Prints one line per Source and where this checkout's state lives; exits 2, saying what to fix,
# when something is missing. INGEST_TRAILER, when set, becomes the last line of every filing commit.
. "$(dirname "$0")/lib.sh"
[ $# -ge 1 ] || { echo "usage: preflight.sh SLUG …" >&2; exit 2; }

missing=0
for tool in uv git claude; do
  command -v "$tool" >/dev/null || { echo "missing: $tool is not on PATH" >&2; missing=1; }
done
[ "$missing" -eq 0 ] || exit 2

branch="$(git -C "$REPO" branch --show-current)"
if [ -z "$branch" ] || [ "$branch" = "$(default_branch)" ]; then
  echo "on '${branch:-a detached HEAD}': filing commits need a working branch, create one first" >&2
  exit 2
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "warning: gh is not logged in (gh auth login): pushes go through git's own credentials and may be refused"
fi

# The trailer is this session's, Source by Source: a later one without it leaves none behind.
for slug in "$@"; do
  [[ "$slug" =~ ^[a-z0-9-]+$ ]] || continue
  mkdir -p "$STATE/$slug"
  rm -f "$STATE/$slug/commit-trailer"
  # Where this session's results start: the report counts from here, across its queues.
  touch "$STATE/$slug/results.tsv"
  wc -l <"$STATE/$slug/results.tsv" | tr -d ' ' >"$STATE/$slug/session-offset"
  if [ -n "${INGEST_TRAILER:-}" ]; then printf '%s\n' "$INGEST_TRAILER" >"$STATE/$slug/commit-trailer"; fi
done

uv --directory "$SCRIPTS" run --quiet python - "$@" <<'PY' || exit 2
import sys

from wikipol.config import ConfigError, load_index_settings, load_settings, load_sources, pinned_model

try:
    load_settings()  # the bucket and its keys
    by_slug = {source.slug: source for source in load_sources()}
    for slug in sys.argv[1:]:
        if slug not in by_slug:
            raise ConfigError(f"no Source with slug {slug}; the Sources are {', '.join(by_slug)}")
        source = by_slug[slug]
        if not source.channel_url:
            raise ConfigError(f"{slug}: source.yaml has no youtube.channel_url")
        digests = sum(1 for p in source.chronicle.rglob("*.md") if p.name != "CLAUDE.md")
        print(
            f"{slug}: {source.name}, {source.channel_url}, "
            f"{f'from {source.since}' if source.since else 'the whole channel'}, "
            f"written by {pinned_model(source)}, {digests} Digests in its Chronicle"
        )
except ConfigError as error:
    sys.exit(f"wikipol: {error}")
try:
    load_index_settings()
except ConfigError as error:
    print(f"warning: the search index will be skipped: {error}")
PY
echo "branch: $branch"
echo "state: $STATE"

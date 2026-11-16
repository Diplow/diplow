# Sourced by every script of ingest-source: where the repo, the pipeline and this checkout's
# state are, and the lock the scripts share.
set -u

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO="$(git -C "$here" rev-parse --show-toplevel)"
SCRIPTS="$REPO/6-politics/1-projects/1-wikipol/Scripts"
SOURCES="$REPO/6-politics/2-sources"
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/wikipol"
# One state folder per checkout: a queue says what this checkout's Chronicle lacks, and a staged
# Digest must be filed in the checkout that wrote it. Outside the repo, where `wikipol digest`
# gives a Digest the Chronicle as its parent.
STATE="$CACHE/ingest/$(basename "$REPO")-$(printf %s "$REPO" | shasum | cut -c1-8)"

wikipol() { uv --directory "$SCRIPTS" run --quiet wikipol "$@"; }

# need_slug SLUG: stops unless a Source declares that slug.
need_slug() {
  [[ "${1:-}" =~ ^[a-z0-9-]+$ ]] || { echo "usage: $(basename "$0") SLUG …" >&2; exit 2; }
  grep -lEq "^  slug: \"?$1\"?[[:space:]]*(#.*)?$" "$SOURCES"/*/source.yaml 2>/dev/null \
    || { echo "no Source with slug $1 under $SOURCES" >&2; exit 2; }
}

# state_of SLUG: prints the Source's state folder, created with its staging.
state_of() {
  mkdir -p "$STATE/$1/staged" "$STATE/$1/filed"
  printf %s "$STATE/$1"
}

# take_lock DIR PATTERN: one holder at a time. A holder that died is replaced once no process
# matching PATTERN (the command it was running) is left: a tool timeout can stop a script and
# leave its `wikipol` child working.
take_lock() {
  local lock="$1" pattern="$2" pid
  mkdir -p "$(dirname "$lock")"
  until mkdir "$lock" 2>/dev/null; do
    pid="$(cat "$lock/pid" 2>/dev/null || true)"
    if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null && ! pgrep -f "$pattern" >/dev/null; then
      rm -rf "$lock"
      continue
    fi
    sleep 5
  done
  echo $$ >"$lock/pid"
}

default_branch() {
  local head
  head="$(git -C "$REPO" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)"
  printf %s "${head#origin/}" | grep . || printf main
}

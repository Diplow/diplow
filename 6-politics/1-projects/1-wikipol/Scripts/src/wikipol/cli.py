"""`wikipol <command>`: the pipeline's entry points."""

from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

from wikipol import fetch
from wikipol.config import (
    DEFAULT_SOURCES_DIR,
    FETCHERS,
    REPO_ROOT,
    ConfigError,
    Source,
    load_fetcher_settings,
    load_settings,
    load_sources,
    pinned_model,
)
from wikipol.digest.format import DigestFields, check_digest, split_digest
from wikipol.digest.raw_text import parse_raw
from wikipol.digest.write import (
    ClaudeCli,
    DigestRejected,
    WriterFailed,
    linkable_digests,
    write_digest,
)
from wikipol.drive_copy import DEFAULT_DRIVE_ROOT, copy_source, format_report
from wikipol.fetch.fetcher import FetchFailed
from wikipol.fetch.run import fetch_source
from wikipol.fetch.run import format_report as format_fetch_report
from wikipol.raw_store import YOUTUBE_ID, RawNotFound, S3RawStore


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="wikipol")
    commands = parser.add_subparsers(dest="command", required=True)

    copy = commands.add_parser(
        "copy-from-drive",
        help="copy the Raws from Google Drive into the bucket; never replaces one",
    )
    copy.add_argument("--source", action="append", help="a Source slug; every Source when absent")
    copy.add_argument("--sources-dir", type=Path, default=DEFAULT_SOURCES_DIR)
    copy.add_argument("--drive-root", default=DEFAULT_DRIVE_ROOT)
    copy.add_argument(
        "--dry-run", action="store_true", help="read Drive and the bucket, write nothing"
    )

    get = commands.add_parser(
        "fetch",
        help="list a Source's channel and store the Raws the bucket lacks, newest first",
    )
    get.add_argument("--source", required=True, help="the Source's slug")
    get.add_argument("--limit", type=positive_int, help="try at most N videos")
    get.add_argument("--fetcher", choices=FETCHERS, help="default: WIKIPOL_FETCHER, else yt-dlp")
    get.add_argument("--sources-dir", type=Path, default=DEFAULT_SOURCES_DIR)
    get.add_argument("--dry-run", action="store_true", help="only list the videos without a Raw")

    digest = commands.add_parser(
        "digest",
        help="write one Publication's Digest with the write-digest skill, checked before kept",
    )
    digest.add_argument("--source", required=True, help="the Source's slug")
    digest.add_argument("--id", required=True, dest="youtube_id", help="the video's YouTube id")
    digest.add_argument("--out", required=True, type=Path, help="the Digest file to write")
    digest.add_argument("--sources-dir", type=Path, default=DEFAULT_SOURCES_DIR)

    check = commands.add_parser(
        "check-digest", help="check Digest files against their Raw in the bucket"
    )
    check.add_argument("digests", nargs="+", type=Path)
    check.add_argument("--sources-dir", type=Path, default=DEFAULT_SOURCES_DIR)

    args = parser.parse_args(argv)
    try:
        if args.command == "copy-from-drive":
            return copy_from_drive(args)
        if args.command == "fetch":
            return fetch_raws(args)
        if args.command == "digest":
            return write_one_digest(args)
        if args.command == "check-digest":
            return check_digests(args)
    except (WriterFailed, RawNotFound) as error:
        print(f"wikipol: {error}", file=sys.stderr)
        return 2
    except FetchFailed as error:
        print(f"wikipol: {error}", file=sys.stderr)
        return 2
    except ConfigError as error:
        print(f"wikipol: {error}", file=sys.stderr)
        return 2
    except FileNotFoundError as error:
        print(f"wikipol: {error.filename or error} not found", file=sys.stderr)
        return 2
    except subprocess.CalledProcessError as error:
        print(f"wikipol: {error.cmd[0]} exited with {error.returncode}", file=sys.stderr)
        return 2
    return 1


def copy_from_drive(args: argparse.Namespace) -> int:
    sources = load_sources(args.sources_dir)
    if args.source:
        unknown = set(args.source) - {s.slug for s in sources}
        if unknown:
            raise ConfigError(f"no Source with slug {', '.join(sorted(unknown))}")
        sources = [s for s in sources if s.slug in args.source]
    store = S3RawStore.from_settings(load_settings())
    reports = [
        copy_source(s, store, drive_root=args.drive_root, dry_run=args.dry_run) for s in sources
    ]
    print(format_report(reports, dry_run=args.dry_run))
    return 1 if any(r.conflicts for r in reports) else 0


def positive_int(text: str) -> int:
    value = int(text)
    if value < 1:
        raise argparse.ArgumentTypeError("must be 1 or more")
    return value


def fetch_raws(args: argparse.Namespace) -> int:
    by_slug = {s.slug: s for s in load_sources(args.sources_dir)}
    if args.source not in by_slug:
        raise ConfigError(f"no Source with slug {args.source}")
    fetcher = fetch.make_fetcher(load_fetcher_settings(kind=args.fetcher))
    store = S3RawStore.from_settings(load_settings())
    report = fetch_source(
        by_slug[args.source],
        store,
        fetcher,
        limit=args.limit,
        dry_run=args.dry_run,
        log=lambda line: print(line, file=sys.stderr, flush=True),
    )
    print(format_fetch_report(report, dry_run=args.dry_run))
    return 1 if report.stopped else 0


def source_by_slug(sources_dir: Path, slug: str) -> Source:
    by_slug = {s.slug: s for s in load_sources(sources_dir)}
    if slug not in by_slug:
        raise ConfigError(f"no Source with slug {slug}")
    return by_slug[slug]


def repo_path(path: Path) -> str | None:
    """`path` relative to the repo root, or None when it lies outside the repo."""
    try:
        return path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return None


def write_one_digest(args: argparse.Namespace) -> int:
    source = source_by_slug(args.sources_dir, args.source)
    if not YOUTUBE_ID.fullmatch(args.youtube_id):
        raise ConfigError(f"{args.youtube_id!r} is not a YouTube id")
    # The Digest's parent is the Period it is written in; outside the repo, the Chronicle.
    parent = repo_path(args.out.parent) or repo_path(source.chronicle) or "1-chronicle"
    store = S3RawStore.from_settings(load_settings())
    try:
        digest = write_digest(
            source,
            args.youtube_id,
            store,
            ClaudeCli(),
            parent=parent,
            today=date.today(),
            linkable=linkable_digests(source),
        )
    except DigestRejected as rejected:
        kept = Path(tempfile.mkdtemp(prefix="wikipol-rejected-")) / f"{args.youtube_id}.md"
        kept.write_text(rejected.draft, encoding="utf-8")
        print(f"wikipol: the Digest of {args.youtube_id} was rejected twice:", file=sys.stderr)
        for problem in rejected.problems:
            print(f"  - {problem}", file=sys.stderr)
        print(f"  last draft: {kept}", file=sys.stderr)
        return 1
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(digest.text, encoding="utf-8")
    print(f"{args.out}: written by {digest.fields.model} in {digest.drafts} draft(s)")
    return 0


def check_digests(args: argparse.Namespace) -> int:
    store = S3RawStore.from_settings(load_settings())
    failed = 0
    for path in args.digests:
        text = path.read_text(encoding="utf-8")
        frontmatter, _ = split_digest(text)
        if frontmatter is None:
            problems = ["no readable YAML frontmatter"]
        else:
            source = source_by_slug(args.sources_dir, str(frontmatter.get("source")))
            youtube_id = str(frontmatter.get("youtube_id"))
            raw = store.get(source.slug, youtube_id)
            expected = DigestFields(
                title=str(frontmatter.get("title")),
                parent=repo_path(path.parent) or str(frontmatter.get("parent")),
                source=source.slug,
                youtube_id=youtube_id,
                published=frontmatter.get("published"),
                duration=raw.meta.duration or frontmatter.get("duration"),
                ingested=frontmatter.get("ingested"),
                model=pinned_model(source),
            )
            linkable = set(linkable_digests(source)) - {repo_path(path.with_suffix(""))}
            problems = check_digest(text, parse_raw(raw.body.decode("utf-8")), expected, linkable)
        print(f"{path}: {'ok' if not problems else f'{len(problems)} problems'}")
        for problem in problems:
            print(f"  - {problem}")
        failed += bool(problems)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

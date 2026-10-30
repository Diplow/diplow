"""`wikipol <command>`: the pipeline's entry points."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from wikipol import fetch
from wikipol.config import (
    DEFAULT_SOURCES_DIR,
    FETCHERS,
    ConfigError,
    load_fetcher_settings,
    load_settings,
    load_sources,
)
from wikipol.drive_copy import DEFAULT_DRIVE_ROOT, copy_source, format_report
from wikipol.fetch.fetcher import FetchFailed
from wikipol.fetch.run import fetch_source
from wikipol.fetch.run import format_report as format_fetch_report
from wikipol.raw_store import S3RawStore


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
    get.add_argument(
        "--dry-run", action="store_true", help="list what is missing, fetch and write nothing"
    )

    args = parser.parse_args(argv)
    try:
        if args.command == "copy-from-drive":
            return copy_from_drive(args)
        if args.command == "fetch":
            return fetch_raws(args)
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


if __name__ == "__main__":
    sys.exit(main())

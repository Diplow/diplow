"""`wikipol <command>`: the pipeline's entry points."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from wikipol.config import DEFAULT_SOURCES_DIR, ConfigError, load_settings, load_sources
from wikipol.drive_copy import DEFAULT_DRIVE_ROOT, copy_source, format_report
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

    args = parser.parse_args(argv)
    try:
        if args.command == "copy-from-drive":
            return copy_from_drive(args)
    except ConfigError as error:
        print(f"wikipol: {error}", file=sys.stderr)
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


if __name__ == "__main__":
    sys.exit(main())

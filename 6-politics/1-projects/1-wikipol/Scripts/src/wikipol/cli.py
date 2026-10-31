"""`wikipol <command>`: the pipeline's entry points."""

from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

from wikipol import fetch
from wikipol.backfill import backfill, default_staging
from wikipol.backfill import format_report as format_backfill_report
from wikipol.chronicle.filing import FilingError, plan_filing
from wikipol.chronicle.period import PeriodRejected, write_period
from wikipol.claude import ClaudeCli, WriterFailed
from wikipol.config import (
    DEFAULT_SOURCES_DIR,
    FETCHERS,
    REPO_ROOT,
    ConfigError,
    Source,
    load_fetcher_settings,
    load_index_settings,
    load_settings,
    load_sources,
)
from wikipol.digest.format import check_digest, split_digest
from wikipol.digest.raw_text import parse_raw
from wikipol.digest.write import DigestRejected, digest_fields, linkable_digests, write_digest
from wikipol.drive_copy import DEFAULT_DRIVE_ROOT, copy_source, format_report
from wikipol.fetch.fetcher import FetchFailed
from wikipol.fetch.run import fetch_source
from wikipol.fetch.run import format_report as format_fetch_report
from wikipol.index.embed import ScalewayEmbedder
from wikipol.index.run import format_report as format_index_report
from wikipol.index.run import index_source
from wikipol.index.store import PostgresIndex, SchemaNotApplied
from wikipol.legacy_index import find_video_note
from wikipol.raw_store import YOUTUBE_ID, RawNotFound, RawStore, S3RawStore


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

    filing = commands.add_parser(
        "file",
        help="file Digests in their Source's Chronicle; write-period rewrites every Period touched",
    )
    filing.add_argument("--source", required=True, help="the Source's slug")
    filing.add_argument("digests", nargs="+", type=Path, help="Digest files, outside the Chronicle")
    filing.add_argument("--sources-dir", type=Path, default=DEFAULT_SOURCES_DIR)

    back = commands.add_parser(
        "backfill",
        help="digest the Raws without an up-to-date Digest, oldest first, and file them; "
        "resumes where it stopped",
    )
    back.add_argument("--source", required=True, help="the Source's slug")
    back.add_argument("--limit", type=positive_int, help="hand at most N Raws to write-digest")
    back.add_argument(
        "--staging",
        type=Path,
        help="where Digests wait to be filed; default: ~/.cache/wikipol/backfill/<slug>",
    )
    back.add_argument("--sources-dir", type=Path, default=DEFAULT_SOURCES_DIR)
    back.add_argument(
        "--dry-run", action="store_true", help="only list the Raws it would digest, oldest first"
    )

    search = commands.add_parser(
        "index",
        help="put the Raws the search index lacks in it, as Publications and embedded chunks",
    )
    search.add_argument("--source", action="append", help="a Source slug; every Source when absent")
    search.add_argument("--limit", type=positive_int, help="index at most N Raws per Source")
    search.add_argument("--sources-dir", type=Path, default=DEFAULT_SOURCES_DIR)
    search.add_argument(
        "--dry-run",
        action="store_true",
        help="read the bucket and the index, embed and write nothing; estimates the tokens",
    )

    commands.add_parser(
        "migrate",
        help="apply the search index's schema; needs a database key that may create tables",
    )

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
        if args.command == "file":
            return file_digests(args)
        if args.command == "backfill":
            return backfill_source(args)
        if args.command == "index":
            return index_raws(args)
        if args.command == "migrate":
            return migrate_index()
    except (WriterFailed, RawNotFound, IndexUnreachable, SchemaNotApplied) as error:
        print(f"wikipol: {error}", file=sys.stderr)
        return 2
    except FetchFailed as error:
        print(f"wikipol: {error}", file=sys.stderr)
        return 2
    except (ConfigError, FilingError) as error:
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
            # Not itself, when it replaces a Digest already in the Chronicle.
            linkable={
                target: title
                for target, title in linkable_digests(source).items()
                if target != repo_path(args.out.with_suffix(""))
            },
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
        problems = check_one_digest(path, store, args.sources_dir)
        print(f"{path}: {'ok' if not problems else f'{len(problems)} problems'}")
        for problem in problems:
            print(f"  - {problem}")
        failed += bool(problems)
    return 1 if failed else 0


def check_one_digest(path: Path, store: RawStore, sources_dir: Path) -> list[str]:
    """What is wrong with one Digest file, read against its Raw; a file the check can't even
    place (no Source, no Raw) says so in its problems, and the next file is still checked."""
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as error:
        return [f"can't be read: {error}"]
    frontmatter, _ = split_digest(text)
    if frontmatter is None:
        return ["no readable YAML frontmatter"]
    youtube_id = str(frontmatter.get("youtube_id") or "")
    try:
        source = source_by_slug(sources_dir, str(frontmatter.get("source") or ""))
        raw = store.get(source.slug, youtube_id)
        raw_text = parse_raw(raw.body.decode("utf-8"))
    except (ConfigError, RawNotFound, ValueError) as error:  # UnicodeDecodeError included
        return [f"can't be checked: {error}"]
    # What the pipeline would write today, but for the model that wrote the Digest, which may
    # predate today's pin (only an alias is refused), and the day it was written.
    expected = digest_fields(
        source,
        raw,
        find_video_note(source.legacy_vault, youtube_id),
        parent=repo_path(path.parent) or str(frontmatter.get("parent")),
        ingested=frontmatter.get("ingested"),
        model=frontmatter.get("model"),
    )
    linkable = set(linkable_digests(source)) - {repo_path(path.with_suffix(""))}
    return check_digest(text, raw_text, expected, linkable)


def repo_of(sources_dir: Path) -> Path:
    """The repo a Sources folder belongs to: it sits at <repo>/6-politics/2-sources, as
    config.REPO_ROOT has it. Anywhere else, links would be followed in the wrong tree."""
    sources_dir = sources_dir.resolve()
    if (sources_dir.parent.name, sources_dir.name) != ("6-politics", "2-sources"):
        raise ConfigError(f"{sources_dir} is not a repo's 6-politics/2-sources")
    return sources_dir.parents[1]


def file_digests(args: argparse.Namespace) -> int:
    source = source_by_slug(args.sources_dir, args.source)
    for path in args.digests:
        if path.resolve().is_relative_to(source.chronicle.resolve()):
            raise ConfigError(f"{path} is already in the Chronicle: file a copy from outside it")
    filing = plan_filing(
        source,
        [path.read_text(encoding="utf-8") for path in args.digests],
        repo_root=repo_of(args.sources_dir),
    )
    writer = ClaudeCli()
    try:
        filing.summarize(
            lambda period, whole: write_period(source, period, writer, chronicle=whole)
        )
    except PeriodRejected as rejected:
        print(f"wikipol: {rejected}; the Chronicle is unchanged:", file=sys.stderr)
        for problem in rejected.problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1
    relinked = filing.apply()
    for leaf in filing.filed:
        print(f"{leaf.path}.md")
    summarized = len(filing.touched())
    print(
        f"{summarized} Period{'s' if summarized > 1 else ''} summarized by {source.model}, "
        f"{len(filing.moved)} paths moved, {len(relinked)} files outside the Chronicle relinked"
    )
    return 0


def backfill_source(args: argparse.Namespace) -> int:
    source = source_by_slug(args.sources_dir, args.source)
    report = backfill(
        source,
        S3RawStore.from_settings(load_settings()),
        ClaudeCli(),
        staging=args.staging or default_staging(source.slug),
        today=date.today(),
        limit=args.limit,
        dry_run=args.dry_run,
        repo_root=repo_of(args.sources_dir),
        log=lambda line: print(line, file=sys.stderr, flush=True),
    )
    print(format_backfill_report(report, limit=args.limit, dry_run=args.dry_run))
    return 1 if report.failed or report.stopped else 0


class IndexUnreachable(Exception):
    """The index's database refused the connection or a statement."""


def open_index(database_url: str) -> PostgresIndex:
    import psycopg

    try:
        return PostgresIndex.connect(database_url)
    except psycopg.Error as error:
        # psycopg's message may quote the connection string's host, never its password.
        raise IndexUnreachable(f"the index's database refused the connection: {error}") from error


def migrate_index() -> int:
    import psycopg

    index = open_index(load_index_settings(need_embedding=False).database_url)
    try:
        applied = index.migrate()
    except psycopg.Error as error:
        raise IndexUnreachable(f"the index's database failed: {error}") from error
    finally:
        index.close()
    print("\n".join(f"migration applied: {name}" for name in applied) or "the schema is up to date")
    return 0


def index_raws(args: argparse.Namespace) -> int:
    import psycopg

    sources = load_sources(args.sources_dir)
    if args.source:
        unknown = set(args.source) - {s.slug for s in sources}
        if unknown:
            raise ConfigError(f"no Source with slug {', '.join(sorted(unknown))}")
        sources = [s for s in sources if s.slug in args.source]
    settings = load_index_settings(need_embedding=not args.dry_run)
    store = S3RawStore.from_settings(load_settings())
    embedder = ScalewayEmbedder(settings.embedding_key or "", settings.project_id)
    index = open_index(settings.database_url)
    try:
        if not args.dry_run:
            for name in index.migrate():
                print(f"migration applied: {name}", file=sys.stderr)
        reports = [
            index_source(
                source,
                store,
                embedder,
                index,
                repo_root=repo_of(args.sources_dir),
                limit=args.limit,
                dry_run=args.dry_run,
                log=lambda line: print(line, file=sys.stderr, flush=True),
            )
            for source in sources
        ]
    except psycopg.Error as error:
        raise IndexUnreachable(f"the index's database failed: {error}") from error
    finally:
        index.close()
    print(format_index_report(reports, dry_run=args.dry_run))
    return 1 if any(r.stopped for r in reports) else 0


if __name__ == "__main__":
    sys.exit(main())

"""Copy the Raws from Google Drive into the bucket, once.

For each Source with a frozen vault, rclone copies its transcripts from Drive into a temporary
folder, and each file goes to the bucket under its YouTube id, its bytes unchanged. The id comes
from the transcript's frontmatter (`youtube_id`, else a `watch?v=` `url`), else from the vault's
notes; the publication date from the frontmatter's `date`, else from the vault. A transcript
whose id stays unknown is listed, not copied.

Running it again copies only what is missing. A Raw already in the bucket is never replaced:
same bytes count as already there, different bytes as a conflict, left for a human.
"""

from __future__ import annotations

import subprocess
import tempfile
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from wikipol.config import Source
from wikipol.legacy_index import WATCH_URL, LegacyIndex, build_index, parse_date, split_frontmatter
from wikipol.raw_store import YOUTUBE_ID, RawMeta, RawStore

DEFAULT_DRIVE_ROOT = "diplow:WikiPol/Sources"

Fetch = Callable[[str, Path], None]
"""Copies every file of a remote folder into a local one."""


def rclone_copy(remote: str, local: Path) -> None:
    subprocess.run(["rclone", "copy", remote, str(local)], check=True)


def drive_folder(source: Source, drive_root: str = DEFAULT_DRIVE_ROOT) -> str | None:
    """Drive mirrors the old `Sources/` tree, one folder per vault. No vault, nothing on Drive."""
    if source.legacy_vault is None:
        return None
    return f"{drive_root}/{source.legacy_vault.name}/Sources/Transcripts"


@dataclass(frozen=True)
class Resolved:
    youtube_id: str | None
    meta: RawMeta


def resolve(stem: str, text: str, index: LegacyIndex) -> Resolved:
    frontmatter, _ = split_frontmatter(text)
    youtube_id = str(frontmatter.get("youtube_id") or "").strip()
    if not YOUTUBE_ID.match(youtube_id):
        url = WATCH_URL.search(str(frontmatter.get("url") or ""))
        youtube_id = url.group(1) if url else index.id_by_transcript.get(stem, "")
    published: date | None = parse_date(frontmatter.get("date"))
    if youtube_id and published is None:
        published = index.published_by_id.get(youtube_id)
    title = str(frontmatter.get("titre") or "").strip() or stem
    return Resolved(youtube_id or None, RawMeta(title=title, published=published))


@dataclass
class SourceReport:
    source: str
    on_drive: int = 0
    copied: list[str] = field(default_factory=list)
    already_there: list[str] = field(default_factory=list)
    conflicts: list[str] = field(default_factory=list)
    duplicates: list[str] = field(default_factory=list)
    missing_id: list[str] = field(default_factory=list)
    no_published: list[str] = field(default_factory=list)

    @property
    def in_bucket(self) -> int:
        return len(self.copied) + len(self.already_there) + len(self.conflicts)


def copy_source(
    source: Source,
    store: RawStore,
    fetch: Fetch | None = None,
    drive_root: str = DEFAULT_DRIVE_ROOT,
    dry_run: bool = False,
) -> SourceReport:
    report = SourceReport(source.slug)
    remote = drive_folder(source, drive_root)
    if remote is None:
        return report
    index = build_index(source.legacy_vault, source.legacy_inventory)
    with tempfile.TemporaryDirectory(prefix=f"wikipol-{source.slug}-") as tmp:
        local = Path(tmp)
        (fetch or rclone_copy)(remote, local)
        files = sorted(p for p in local.iterdir() if p.is_file() and p.suffix == ".md")
        report.on_drive = len(files)
        seen: dict[str, str] = {}
        for path in files:
            body = path.read_bytes()
            resolved = resolve(path.stem, body.decode("utf-8", errors="replace"), index)
            youtube_id = resolved.youtube_id
            if youtube_id is None:
                report.missing_id.append(path.name)
                continue
            if youtube_id in seen:
                report.duplicates.append(f"{path.name} (same id as {seen[youtube_id]})")
                continue
            seen[youtube_id] = path.name
            if resolved.meta.published is None:
                report.no_published.append(youtube_id)
            if store.exists(source.slug, youtube_id):
                same = store.get(source.slug, youtube_id).body == body
                (report.already_there if same else report.conflicts).append(youtube_id)
            elif dry_run:
                report.copied.append(youtube_id)
            else:
                store.put(source.slug, youtube_id, body, resolved.meta)
                report.copied.append(youtube_id)
    return report


def format_report(reports: list[SourceReport], dry_run: bool = False) -> str:
    verb = "would copy" if dry_run else "copied"
    lines = []
    for r in reports:
        lines.append(
            f"{r.source}: {r.on_drive} on Drive, {r.in_bucket} in the bucket "
            f"({verb} {len(r.copied)}, {len(r.already_there)} already there, "
            f"{len(r.conflicts)} conflicts), {len(r.duplicates)} duplicates, "
            f"{len(r.missing_id)} without a YouTube id, "
            f"{len(r.no_published)} without a publication date"
        )
        for label, items in (
            ("conflict, left as it is in the bucket", r.conflicts),
            ("duplicate, not copied", r.duplicates),
            ("no YouTube id, not copied", r.missing_id),
        ):
            lines.extend(f"  {label}: {item}" for item in items)
    return "\n".join(lines)

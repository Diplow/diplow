"""Filing Digests in a Source's Chronicle on disk: read the tree, file, summarize, write.

`plan_filing` reads the Chronicle into a tree, files the new Digests in it, numbers everything
again and works out what moved. Nothing is written yet: `Filing.summarize` has `write-period`
rewrite every Period the filing touched, then `Filing.apply` writes the whole Chronicle and
rewrites the wikilinks that named a moved Digest or Period, in the Chronicle and in the rest
of the repo. A summary that fails leaves the disk as it was.
"""

from __future__ import annotations

import os
import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from wikipol.chronicle.period import LINK, read_period, render_period
from wikipol.chronicle.tree import (
    MAX_CHILDREN,
    FilingConflict,
    Leaf,
    Period,
    Summary,
    assign_paths,
    file_leaf,
    moves,
    touched_deepest_first,
)
from wikipol.config import REPO_ROOT, Source
from wikipol.digest.format import split_digest
from wikipol.raw_store import YOUTUBE_ID

CHRONICLE_TITLE = "Chronicle"
# Never read for links: tooling, dependencies, and the frozen vaults, which link no Digest.
SKIPPED_FOLDERS = {"node_modules", "Legacy"}


class FilingError(Exception):
    """The Chronicle or a Digest isn't in a shape the filing can work on. Nothing was written."""


def repo_path(path: Path, repo_root: Path) -> str:
    try:
        return path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError as error:
        raise FilingError(f"{path} is outside the repo at {repo_root}") from error


def read_leaf(text: str, where: str, origin: str | None = None) -> Leaf:
    """A Digest file as the tree needs it; FilingError when it isn't one or has no date."""
    frontmatter, _ = split_digest(text)
    if not frontmatter or "digest_version" not in frontmatter:
        raise FilingError(f"{where} is not a Digest: no frontmatter with digest_version")
    youtube_id = str(frontmatter.get("youtube_id") or "")
    if not YOUTUBE_ID.fullmatch(youtube_id):
        raise FilingError(f"{where}: youtube_id {youtube_id!r} is not a YouTube id")
    published = frontmatter.get("published")
    if not isinstance(published, date) or isinstance(published, datetime):
        raise FilingError(f"{where} has no published date, so no place in a Chronicle")
    return Leaf(
        youtube_id=youtube_id,
        published=published,
        title=str(frontmatter.get("title") or youtube_id),
        preview=" ".join(str(frontmatter.get("preview") or "").split()),
        text=text,
        origin=origin,
    )


def load_period(folder: Path, repo_root: Path, found: set[Path], root: bool = False) -> Period:
    """A Period folder and everything under it, as the tree; every file read goes in `found`."""
    where = repo_path(folder, repo_root)
    claude = folder / "CLAUDE.md"
    if not claude.is_file():
        raise FilingError(f"{where} has no CLAUDE.md, so it is not a Period")
    found.add(claude)
    title, summary = read_period(claude.read_text(encoding="utf-8"))
    period = Period(
        origin=where, summary=summary, fixed_title=(title or CHRONICLE_TITLE) if root else None
    )
    for entry in sorted(folder.iterdir()):
        if entry.name.startswith(".") or entry.name == "CLAUDE.md":
            continue
        if entry.is_dir():
            period.children.append(load_period(entry, repo_root, found))
        elif entry.suffix == ".md":
            text = entry.read_text(encoding="utf-8")
            origin = repo_path(entry.with_suffix(""), repo_root)
            period.children.append(read_leaf(text, f"{where}/{entry.name}", origin))
            found.add(entry)
        else:
            raise FilingError(f"{where}/{entry.name} is neither a Period nor a Digest")
    if len({type(child) for child in period.children}) > 1:
        raise FilingError(f"{where} holds both Digests and Periods")
    if len(period.children) > MAX_CHILDREN:
        raise FilingError(f"{where} holds {len(period.children)} children, {MAX_CHILDREN} at most")
    if not period.children and not root:
        raise FilingError(f"{where} is an empty Period")
    period.children.sort(key=lambda child: child.key)
    return period


def rewrite_links(text: str, moved: dict[str, str]) -> str:
    """The text with every wikilink to a moved Digest or Period pointing at its new path."""

    def follow(match: re.Match[str]) -> str:
        new = moved.get(match.group(1).strip())
        if new is None:
            return match.group(0)
        return f"[[{new}{match.group(2) or ''}{match.group(3) or ''}]]"

    return LINK.sub(follow, text) if moved else text


def set_parent(text: str, parent: str) -> str:
    """A Digest file with its frontmatter's `parent` set to the Period it is filed in."""
    end = text.find("\n---\n", 3)
    head, rest = text[:end], text[end:]
    head, count = re.subn(r"^parent:.*$", f"parent: {parent}", head, count=1, flags=re.M)
    if not count:
        head = f"{head}\nparent: {parent}"
    return head + rest


@dataclass
class Filing:
    source: Source
    repo_root: Path
    root: Period
    filed: list[Leaf]
    found: set[Path]
    moved: dict[str, str]

    def touched(self) -> list[Period]:
        """The Periods to summarize again, each after the Periods under it."""
        return touched_deepest_first(self.root)

    def summarize(self, write: Callable[[Period, bool], Summary]) -> None:
        """Has `write(period, is_the_chronicle)` give every touched Period its new summary."""
        for period in self.touched():
            period.summary = write(period, period is self.root)

    def files(self) -> dict[Path, str]:
        """Every file of the Chronicle once filed, by absolute path."""
        out: dict[Path, str] = {}
        for period in self.root.periods():
            claude = self.repo_root / str(period.path) / "CLAUDE.md"
            # A Period the filing left as it was keeps its file as written, even by hand, but
            # for a link to something that moved.
            out[claude] = (
                render_period(period)
                if changed(period)
                else rewrite_links(claude.read_text("utf-8"), self.moved)
            )
            for child in period.children:
                if isinstance(child, Leaf):
                    out[self.repo_root / f"{child.path}.md"] = set_parent(child.text, period.path)
        return out

    def apply(self) -> list[Path]:
        """Writes the Chronicle and follows the moves in the rest of the repo; returns the files
        it changed outside the Chronicle."""
        files = self.files()  # before anything is touched: it fails on a Period left unsummarized
        # Every new file first, the stale ones after: a write that fails deletes nothing.
        for path, text in files.items():
            if not path.is_file() or path.read_text(encoding="utf-8") != text:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text, encoding="utf-8")
        written = {(stat.st_dev, stat.st_ino): path for path in files if (stat := path.stat())}
        for stale in self.found - files.keys():
            stat = stale.stat()
            same = written.get((stat.st_dev, stat.st_ino))
            if same is None:
                stale.unlink()
            else:  # a name differing only in case, one file on a case-insensitive disk
                stale.rename(same)
        remove_empty_folders(self.source.chronicle)
        return rewrite_repo_links(self.repo_root, self.moved, skip=self.source.chronicle)


def plan_filing(source: Source, digests: Sequence[str], repo_root: Path = REPO_ROOT) -> Filing:
    """The Chronicle of `source` with `digests` (file texts) filed in it, in memory."""
    found: set[Path] = set()
    root = load_period(source.chronicle, repo_root, found, root=True)
    filed: list[Leaf] = []
    for number, text in enumerate(digests, start=1):
        leaf = read_leaf(text, f"Digest {number}")
        if any(leaf.youtube_id == other.youtube_id for other in filed):
            raise FilingError(f"{leaf.youtube_id} is given twice")
        frontmatter, _ = split_digest(text)
        if (frontmatter or {}).get("source") != source.slug:
            raise FilingError(f"{leaf.youtube_id} is a Digest of another Source than {source.slug}")
        try:
            file_leaf(root, leaf)
        except FilingConflict as error:
            raise FilingError(str(error)) from error
        filed.append(leaf)
    assign_paths(root, repo_path(source.chronicle, repo_root))
    moved = moves(root)
    # What was written before this filing names the old paths; from here on, only new ones.
    for period in root.periods():
        if period.summary is not None:
            body = rewrite_links(period.summary.body, moved)
            period.summary = Summary(period.summary.preview, body)
        for child in period.children:
            if isinstance(child, Leaf):
                child.text = rewrite_links(child.text, moved)
    return Filing(source, repo_root, root, filed, found, moved)


def changed(period: Period) -> bool:
    """Whether the Period's file must be written again: its summary, its place or a child's
    place changed."""
    return (
        period.touched
        or period.origin != period.path
        or any(child.origin != child.path for child in period.children)
    )


def remove_empty_folders(top: Path) -> None:
    """Removes the folders under `top` left empty, or holding only dot files, which the
    Chronicle never reads (a Finder `.DS_Store`, an editor's swap file)."""
    for folder, _, names in os.walk(top, topdown=False):
        path = Path(folder)
        if path == top:
            continue
        hidden = all(name.startswith(".") for name in names)
        if hidden and not any(p.is_dir() for p in path.iterdir()):
            for name in names:
                (path / name).unlink()
            path.rmdir()


def rewrite_repo_links(repo_root: Path, moved: dict[str, str], skip: Path) -> list[Path]:
    """Follows the moves in every Markdown file of the repo outside `skip`, dot folders,
    dependencies and the frozen vaults; returns the files it changed."""
    changed: list[Path] = []
    if not moved:
        return changed
    skip = skip.resolve()
    for folder, subfolders, names in os.walk(repo_root):
        subfolders[:] = [
            name
            for name in subfolders
            if not name.startswith(".")
            and name not in SKIPPED_FOLDERS
            and (Path(folder) / name).resolve() != skip
        ]
        for name in names:
            if not name.endswith(".md"):
                continue
            path = Path(folder) / name
            try:
                text = path.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            if "[[" not in text or not any(old in text for old in moved):
                continue
            new = rewrite_links(text, moved)
            if new != text:
                path.write_text(new, encoding="utf-8")
                changed.append(path)
    return changed

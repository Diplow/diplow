"""A Chronicle as a tree of Periods split by count (ADR 0001), in memory: no file is read here.

A Period holds either up to six Digests or up to six shorter Periods, never both, in date order.
Filing a Digest walks down to the Period whose dates it falls in, the way a B-tree does. When a
Period overflows to seven, it splits into two of three and four, cut where the dates differ
when they can, and the second half becomes a new sibling right after it; the parent may
overflow in turn. The Chronicle itself is the root and has no sibling: when it overflows, its
children go down into two new Periods under it. So every Digest sits at the same depth, and a
Period's dates never overlap its siblings'.

Children are numbered 1 to 6 in date order, which gives every Digest and Period its path: a
Digest is `N-<slug of its title>.md`, a Period the folder `N-<its first date>`. Its title is
its date range. Filing marks `touched` every Period whose children changed: those get their
Preview and Body rewritten by `write-period`, the deeper ones first.
"""

from __future__ import annotations

import unicodedata
from bisect import insort
from dataclasses import dataclass, field
from datetime import date

MAX_CHILDREN = 6
SLUG_WORDS = 6
SLUG_CHARS = 60


@dataclass(frozen=True)
class Summary:
    """What `write-period` writes for a Period: its Preview and the Body above its contents."""

    preview: str
    body: str


@dataclass(eq=False)
class Leaf:
    """A Digest, as the tree knows it."""

    youtube_id: str
    published: date
    title: str
    preview: str
    text: str
    """The whole file; its `parent` is set when it is written."""
    origin: str | None = None
    """Its repo path without `.md` before this filing; None for a Digest filed now."""
    path: str | None = None

    @property
    def key(self) -> tuple[date, str]:
        return self.published, self.youtube_id


@dataclass(eq=False)
class Period:
    children: list[Period | Leaf] = field(default_factory=list)
    origin: str | None = None
    """Its folder's repo path before this filing; None for a Period this filing creates."""
    summary: Summary | None = None
    touched: bool = False
    fixed_title: str | None = None
    """The Chronicle's own title; a Period's title is its date range."""
    path: str | None = None

    @property
    def holds_digests(self) -> bool:
        return not self.children or isinstance(self.children[0], Leaf)

    @property
    def key(self) -> tuple[date, str]:
        """Its first Digest's key."""
        return self.children[0].key

    @property
    def start(self) -> date:
        first = self.children[0]
        return first.published if isinstance(first, Leaf) else first.start

    @property
    def end(self) -> date:
        last = self.children[-1]
        return last.published if isinstance(last, Leaf) else last.end

    @property
    def title(self) -> str:
        if self.fixed_title is not None:
            return self.fixed_title
        return date_range(self.start, self.end)

    def leaves(self) -> list[Leaf]:
        """Its Digests, in date order."""
        found: list[Leaf] = []
        for child in self.children:
            found.extend([child] if isinstance(child, Leaf) else child.leaves())
        return found

    def periods(self) -> list[Period]:
        """Itself and every Period under it, parents before their children."""
        found = [self]
        for child in self.children:
            if isinstance(child, Period):
                found.extend(child.periods())
        return found


class FilingConflict(Exception):
    """A Digest can't be filed as asked: it is already in the Chronicle under another date."""


def date_range(start: date, end: date) -> str:
    return start.isoformat() if start == end else f"{start.isoformat()} → {end.isoformat()}"


def slugify(title: str, fallback: str) -> str:
    """The title's first words, ASCII, lowercase, `-` between them; `fallback` when none is left."""
    slug = "-".join(ascii_words(title)[:SLUG_WORDS])[:SLUG_CHARS].strip("-")
    return slug or "-".join(ascii_words(fallback))


def ascii_words(text: str) -> list[str]:
    """The text's words, lowercase, accents dropped; any other sign parts two words."""
    letters = (
        c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c)
    )
    return "".join(c if c.isascii() and c.isalnum() else " " for c in letters).split()


def file_leaf(root: Period, leaf: Leaf) -> None:
    """Files one Digest in the tree, splitting what overflows, and marks what it touched.

    A Digest already in the tree under the same date replaces it in place; under another date it
    raises FilingConflict, since moving it would leave its old Period short of a Digest.
    """
    found = locate(root, leaf.youtube_id)
    if found is not None:
        trail, old = found
        if old.key != leaf.key:
            raise FilingConflict(
                f"{leaf.youtube_id} is already filed at {old.path or old.origin}, published "
                f"{old.published.isoformat()}, not {leaf.published.isoformat()}"
            )
        holder = trail[-1]
        leaf.origin = old.origin
        holder.children[holder.children.index(old)] = leaf
        for period in trail:
            period.touched = True
        return

    trail = [root]
    while not trail[-1].holds_digests:
        trail.append(pick_child(trail[-1], leaf.key))
    insort(trail[-1].children, leaf, key=lambda child: child.key)
    for period in trail:
        period.touched = True

    for depth in range(len(trail) - 1, -1, -1):
        period = trail[depth]
        if len(period.children) <= MAX_CHILDREN:
            break
        cut = split_point(period.children)
        first, second = period.children[:cut], period.children[cut:]
        if depth == 0:
            period.children = [Period(first, touched=True), Period(second, touched=True)]
        else:
            parent = trail[depth - 1]
            period.children = first
            at = parent.children.index(period) + 1
            parent.children.insert(at, Period(second, touched=True))


def pick_child(period: Period, key: tuple[date, str]) -> Period:
    """The child Period a key goes into: the last one starting at or before it, else the first."""
    chosen = period.children[0]
    for child in period.children:
        if child.key <= key:
            chosen = child
    assert isinstance(chosen, Period)
    return chosen


def split_point(children: list[Period | Leaf]) -> int:
    """Where an overflowing Period cuts: in the middle, its first half the larger, or the other
    middle when only that one falls between two different dates."""
    count = len(children)
    middles = sorted({(count + 1) // 2, count // 2}, reverse=True)
    for cut in middles:
        if last_date(children[cut - 1]) != first_date(children[cut]):
            return cut
    return middles[0]


def first_date(child: Period | Leaf) -> date:
    return child.published if isinstance(child, Leaf) else child.start


def last_date(child: Period | Leaf) -> date:
    return child.published if isinstance(child, Leaf) else child.end


def locate(root: Period, youtube_id: str) -> tuple[list[Period], Leaf] | None:
    """The Periods from the root down to a Digest, and the Digest; None when it isn't filed."""
    for child in root.children:
        if isinstance(child, Leaf):
            if child.youtube_id == youtube_id:
                return [root], child
        else:
            found = locate(child, youtube_id)
            if found is not None:
                return [root, *found[0]], found[1]
    return None


def assign_paths(root: Period, root_path: str) -> None:
    """Numbers every child 1 to 6 in date order and sets the repo path it takes from that."""
    root.path = root_path
    for number, child in enumerate(root.children, start=1):
        if isinstance(child, Leaf):
            child.path = f"{root_path}/{number}-{slugify(child.title, child.youtube_id)}"
        else:
            assign_paths(child, f"{root_path}/{number}-{child.start.isoformat()}")


def moves(root: Period) -> dict[str, str]:
    """Old repo path -> new one, for every Digest and Period whose path changed, as wikilinks
    name them: a Digest without `.md`, a Period by its `CLAUDE` file."""
    moved: dict[str, str] = {}
    for period in root.periods():
        if period.origin is not None and period.origin != period.path:
            moved[f"{period.origin}/CLAUDE"] = f"{period.path}/CLAUDE"
        for child in period.children:
            if isinstance(child, Leaf) and child.origin is not None and child.origin != child.path:
                moved[child.origin] = str(child.path)
    return moved


def touched_deepest_first(root: Period) -> list[Period]:
    """The touched Periods, each after every Period under it, so a parent is summarized from
    children that already have their Preview."""
    order: list[Period] = []

    def visit(period: Period) -> None:
        for child in period.children:
            if isinstance(child, Period):
                visit(child)
        if period.touched:
            order.append(period)

    visit(root)
    return order

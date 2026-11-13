"""A Period's name: the stretch of calendar its dates cover, as a reader says it.

A Period is cut by count (ADR 0001), so its dates rarely make a calendar unit. Its name is the
span at the finest unit, from the day to the year, in which it covers at most three: `Q1 2024`
when it holds in one, `févr. → mars 2025`, `W52 2025 → W02 2026` when it runs over two or
three, and the coarser unit's name when its months make exactly one (January to March is
`Q1 2024`). Weeks are ISO weeks, numbered in their ISO year; months are French, as the
Chronicle.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date

MAX_UNITS = 3
MONTHS = [
    "janv.", "févr.", "mars", "avr.", "mai", "juin",
    "juil.", "août", "sept.", "oct.", "nov.", "déc.",
]  # fmt: skip


@dataclass(frozen=True)
class Unit:
    """One calendar unit: its rank on the unit's own axis, its name, and its year."""

    rank: int
    name: str
    year: int


def day(d: date) -> Unit:
    return Unit(d.toordinal(), f"{d.day} {MONTHS[d.month - 1]}", d.year)


def week(d: date) -> Unit:
    year, number, _ = d.isocalendar()
    return Unit(date.fromisocalendar(year, number, 1).toordinal() // 7, f"W{number:02d}", year)


def month(d: date) -> Unit:
    return Unit(d.year * 12 + d.month - 1, MONTHS[d.month - 1], d.year)


def quarter(d: date) -> Unit:
    return Unit(d.year * 4 + (d.month - 1) // 3, f"Q{(d.month - 1) // 3 + 1}", d.year)


def semester(d: date) -> Unit:
    return Unit(d.year * 2 + (d.month - 1) // 6, f"S{(d.month - 1) // 6 + 1}", d.year)


def year(d: date) -> Unit:
    return Unit(d.year, "", d.year)


SCALES: list[Callable[[date], Unit]] = [day, week, month, quarter, semester, year]


def span_label(start: date, end: date) -> str:
    """The name of the stretch from `start` to `end`, at the finest unit that covers it in at
    most MAX_UNITS, in years past that; a whole quarter, semester or year by its own name."""
    for scale in SCALES:
        first, last = scale(start), scale(end)
        if last.rank - first.rank < MAX_UNITS or scale is year:
            break
    if scale in (month, quarter, semester):
        whole = whole_unit(month(start).rank, month(end).rank)
        if whole is not None:
            return render(whole(start), whole(start), day_scale=False, same_month=True)
    return render(first, last, day_scale=scale is day, same_month=start.month == end.month)


def whole_unit(first: int, last: int) -> Callable[[date], Unit] | None:
    """The coarsest unit whose months, ranked `first` to `last`, are exactly all of one, so
    that January to March says `Q1`; None when there is none."""
    for size, scale in ((12, year), (6, semester), (3, quarter)):
        if first % size == 0 and last == first + size - 1:
            return scale
    return None


def render(first: Unit, last: Unit, day_scale: bool, same_month: bool) -> str:
    if not first.name:  # years
        return f"{first.year}" if first == last else f"{first.year} → {last.year}"
    if first == last:
        return f"{first.name} {first.year}"
    if first.year != last.year:
        return f"{first.name} {first.year} → {last.name} {last.year}"
    if day_scale and same_month:  # `2 → 4 avr. 2026`, the month said once
        return f"{first.name.split()[0]} → {last.name} {last.year}"
    return f"{first.name} → {last.name} {last.year}"

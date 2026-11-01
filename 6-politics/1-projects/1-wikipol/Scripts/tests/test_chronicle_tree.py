"""The Chronicle's split by count, on synthetic dates: no file, no model."""

import random
from datetime import date, timedelta

import pytest

from wikipol.chronicle.tree import (
    MAX_CHILDREN,
    FilingConflict,
    Leaf,
    Period,
    assign_paths,
    file_leaf,
    first_date,
    last_date,
    moves,
    slugify,
    touched_deepest_first,
)

JAN_1 = date(2025, 1, 1)


def leaf(number: int, day: date) -> Leaf:
    return Leaf(f"v{number:010d}", day, f"Vidéo n°{number} : élan !", f"Preview {number}.", "")


def chronicle(days: list[date]) -> Period:
    root = Period(fixed_title="Chronicle")
    for number, day in enumerate(days, start=1):
        file_leaf(root, leaf(number, day))
    assign_paths(root, "c")
    return root


def depth_of_digests(root: Period) -> set[int]:
    depths: set[int] = set()

    def walk(period: Period, depth: int) -> None:
        if period.holds_digests:
            depths.add(depth)
        for child in period.children:
            if isinstance(child, Period):
                walk(child, depth + 1)

    walk(root, 0)
    return depths


def assert_holds(root: Period, count: int) -> None:
    """The rule of 6, never Digests and Periods side by side, every Digest at the same depth,
    siblings in date order without overlap, and each Digest once."""
    for period in root.periods():
        assert 1 <= len(period.children) <= MAX_CHILDREN
        assert len({type(child) for child in period.children}) == 1
        for before, after in zip(period.children, period.children[1:], strict=False):
            assert before.key < after.key
            assert last_date(before) <= first_date(after)
    assert len(depth_of_digests(root)) == 1
    keys = [digest.key for digest in root.leaves()]
    assert keys == sorted(keys)
    assert len(set(keys)) == len(keys) == count


def test_one_digest_sits_in_the_chronicle_itself():
    root = chronicle([JAN_1])

    assert root.holds_digests
    assert [child.path for child in root.children] == ["c/1-video-n-1-elan"]
    assert touched_deepest_first(root) == [root]
    assert root.title == "Chronicle"


def test_a_seventh_digest_splits_the_chronicle_into_two_periods_of_four_and_three():
    root = chronicle([JAN_1 + timedelta(days=n) for n in range(7)])

    first, second = root.children
    assert [len(first.children), len(second.children)] == [4, 3]
    assert (first.path, second.path) == ("c/1-2025-01-01", "c/2-2025-01-05")
    assert (first.title, second.title) == ("2025-01-01 → 2025-01-04", "2025-01-05 → 2025-01-07")
    assert first.children[0].path == "c/1-2025-01-01/1-video-n-1-elan"
    assert second.children[0].path == "c/2-2025-01-05/1-video-n-5-elan"
    assert touched_deepest_first(root) == [first, second, root]
    assert_holds(root, 7)


def test_a_period_whose_digests_share_a_day_is_titled_by_that_day():
    root = chronicle([JAN_1] * 7)

    assert [period.title for period in root.children] == ["2025-01-01", "2025-01-01"]
    assert_holds(root, 7)


def test_the_cut_falls_between_two_dates_when_the_other_middle_can():
    days = [JAN_1 + timedelta(days=n) for n in (0, 1, 2, 3, 3, 4, 5)]

    root = chronicle(days)

    assert [len(period.children) for period in root.children] == [3, 4]
    assert root.children[0].end < root.children[1].start


def test_283_digests_in_one_year_keep_the_rule_of_6_at_one_depth():
    days = [JAN_1 + timedelta(days=n * 365 // 283) for n in range(283)]

    root = chronicle(days)

    assert_holds(root, 283)
    assert depth_of_digests(root) == {3}  # 6 ** 3 = 216 < 283: three levels of Periods
    assert (root.start, root.end) == (JAN_1, date(2025, 12, 30))
    paths = [digest.path for digest in root.leaves()]
    assert len(set(paths)) == 283


def test_digests_filed_out_of_order_end_in_date_order():
    days = [JAN_1 + timedelta(days=n * 365 // 283) for n in range(283)]
    numbered = list(enumerate(days, start=1))
    random.Random(5).shuffle(numbered)

    root = Period(fixed_title="Chronicle")
    for number, day in numbered:
        file_leaf(root, leaf(number, day))
    assign_paths(root, "c")

    assert_holds(root, 283)
    assert [digest.youtube_id for digest in root.leaves()] == [
        f"v{number:010d}" for number in range(1, 284)
    ]


def test_the_same_digests_in_the_same_order_give_the_same_paths():
    days = [JAN_1 + timedelta(days=n % 40) for n in range(100)]

    first = [digest.path for digest in chronicle(days).leaves()]
    again = [digest.path for digest in chronicle(days).leaves()]

    assert first == again


def test_an_older_digest_renumbers_the_ones_after_it_and_says_they_moved():
    root = chronicle([JAN_1 + timedelta(days=n) for n in range(1, 4)])
    for digest in root.leaves():
        digest.origin = digest.path
    root.origin = root.path

    file_leaf(root, leaf(9, JAN_1))
    assign_paths(root, "c")

    assert [digest.path for digest in root.leaves()] == [
        "c/1-video-n-9-elan",
        "c/2-video-n-1-elan",
        "c/3-video-n-2-elan",
        "c/4-video-n-3-elan",
    ]
    assert moves(root) == {
        "c/1-video-n-1-elan": "c/2-video-n-1-elan",
        "c/2-video-n-2-elan": "c/3-video-n-2-elan",
        "c/3-video-n-3-elan": "c/4-video-n-3-elan",
    }


def test_a_split_period_keeps_its_folder_and_a_moved_period_names_its_claude_file():
    root = chronicle([JAN_1 + timedelta(days=n) for n in range(7)])
    for period in root.periods():
        period.origin = period.path
        period.touched = False
    for digest in root.leaves():
        digest.origin = digest.path

    file_leaf(root, leaf(99, date(2024, 12, 31)))  # first Period: 5 Digests, no split
    assign_paths(root, "c")

    assert moves(root)["c/1-2025-01-01/CLAUDE"] == "c/1-2024-12-31/CLAUDE"
    assert "c/2-2025-01-05/CLAUDE" not in moves(root)


def test_appending_touches_only_the_periods_above_the_new_digest():
    root = chronicle([JAN_1 + timedelta(days=n) for n in range(60)])
    for period in root.periods():
        period.touched = False

    file_leaf(root, leaf(61, date(2025, 3, 15)))

    touched = touched_deepest_first(root)
    newest = root.leaves()[-1]
    assert newest.youtube_id == "v0000000061"
    trail = [root]
    while not trail[-1].holds_digests:
        trail.append(trail[-1].children[-1])
    assert touched == list(reversed(trail))
    assert len(touched) < len(root.periods())


def test_a_digest_filed_again_on_the_same_day_replaces_itself_in_place():
    root = chronicle([JAN_1 + timedelta(days=n) for n in range(7)])
    for period in root.periods():
        period.touched = False
    again = leaf(2, JAN_1 + timedelta(days=1))
    again.preview = "Une version 2."

    file_leaf(root, again)

    assert root.children[0].children[1] is again
    assert touched_deepest_first(root) == [root.children[0], root]
    assert len(root.leaves()) == 7


def test_a_digest_filed_again_on_another_day_is_refused():
    root = chronicle([JAN_1, JAN_1 + timedelta(days=1)])

    with pytest.raises(FilingConflict, match="already filed"):
        file_leaf(root, leaf(1, date(2025, 6, 1)))


@pytest.mark.parametrize(
    ("title", "slug"),
    [
        (
            "MBAPPÉ TRAITE MAO DE DICTATEUR ET SE FAIT PURGER DU RÉAL (basé) !!",
            "mbappe-traite-mao-de-dictateur-et",
        ),
        ("L'État, c'est nous ?", "l-etat-c-est-nous"),
        ("!!!", "ab-cd-efghij"),
    ],
)
def test_a_digest_s_file_name_is_its_title_s_first_words(title, slug):
    assert slugify(title, fallback="AB_cd-efghij") == slug

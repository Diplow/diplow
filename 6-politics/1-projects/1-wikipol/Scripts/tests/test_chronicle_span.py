from datetime import date

import pytest

from wikipol.chronicle.span import span_label


@pytest.mark.parametrize(
    ("start", "end", "name"),
    [
        (date(2026, 3, 30), date(2026, 3, 30), "30 mars 2026"),
        (date(2026, 4, 2), date(2026, 4, 4), "2 → 4 avr. 2026"),
        (date(2026, 3, 30), date(2026, 4, 1), "30 mars → 1 avr. 2026"),
        (date(2025, 12, 31), date(2026, 1, 2), "31 déc. 2025 → 2 janv. 2026"),
        (date(2025, 11, 10), date(2025, 11, 28), "W46 → W48 2025"),
        (date(2026, 12, 28), date(2027, 1, 1), "W53 2026"),
        (date(2025, 12, 23), date(2026, 1, 8), "W52 2025 → W02 2026"),
        (date(2025, 12, 1), date(2025, 12, 22), "déc. 2025"),
        (date(2025, 2, 15), date(2025, 3, 11), "févr. → mars 2025"),
        (date(2025, 12, 1), date(2026, 2, 15), "déc. 2025 → févr. 2026"),
        (date(2024, 1, 3), date(2024, 3, 28), "Q1 2024"),
        (date(2024, 11, 27), date(2025, 2, 14), "Q4 2024 → Q1 2025"),
        (date(2025, 7, 1), date(2025, 12, 20), "S2 2025"),
        (date(2025, 2, 18), date(2025, 10, 26), "S1 → S2 2025"),
        (date(2024, 1, 2), date(2024, 12, 30), "2024"),
        (date(2016, 10, 3), date(2020, 6, 11), "2016 → 2020"),
    ],
)
def test_a_period_is_named_by_its_span_at_the_finest_unit_covering_it_in_three(start, end, name):
    assert span_label(start, end) == name

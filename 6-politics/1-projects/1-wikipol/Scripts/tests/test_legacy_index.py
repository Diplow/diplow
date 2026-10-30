from datetime import date

from wikipol.legacy_index import LegacyIndex, build_index, parse_date, split_frontmatter


def test_a_videos_note_ties_its_transcript_to_its_id_and_date(demo_tree):
    index = build_index(demo_tree["vault"], demo_tree["vault"] / "Sources" / "Inventaire.md")

    assert index.id_by_transcript["Avec id"] == "aaaaaaaaaaa"
    assert index.id_by_transcript["Lie par une fiche"] == "ddddddddddd"
    assert index.published_by_id["aaaaaaaaaaa"] == date(2025, 7, 27)


def test_an_inventory_row_survives_a_bar_in_its_title(demo_tree):
    index = build_index(demo_tree["vault"], demo_tree["vault"] / "Sources" / "Inventaire.md")

    assert index.id_by_transcript["Sans frontmatter"] == "ccccccccccc"
    assert index.published_by_id["ccccccccccc"] == date(2026, 4, 15)
    assert index.published_by_id["eeeeeeeeeee"] == date(2026, 4, 14)


def test_a_transcript_tied_to_two_ids_is_left_out():
    index = LegacyIndex()
    index.add("Doublon", "aaaaaaaaaaa", None)
    index.add("Doublon", "bbbbbbbbbbb", None)
    index.add("Doublon", "aaaaaaaaaaa", None)

    assert "Doublon" not in index.id_by_transcript
    assert "Doublon" in index.ambiguous


def test_no_vault_no_index():
    assert build_index(None) == LegacyIndex()


def test_dates_in_the_shapes_the_vaults_use():
    assert parse_date(date(2025, 7, 27)) == date(2025, 7, 27)
    assert parse_date("2025-07-27") == date(2025, 7, 27)
    assert parse_date("30 mars 2026") == date(2026, 3, 30)
    assert parse_date("1er août 2025") == date(2025, 8, 1)
    assert parse_date("Tuesday, March 31st 2026") is None
    assert parse_date(None) is None


def test_frontmatter_absent_or_broken_reads_as_empty():
    assert split_frontmatter("0:00\n\ntexte") == ({}, "0:00\n\ntexte")
    assert split_frontmatter("---\n: : :\n---\nbody")[0] == {}
    assert split_frontmatter("---\nyoutube_id: abc\n---\nbody") == ({"youtube_id": "abc"}, "\nbody")

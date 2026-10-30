import subprocess
from datetime import date

import pytest

from wikipol import cli, drive_copy
from wikipol.config import Source, load_source
from wikipol.drive_copy import copy_source, drive_folder, format_report
from wikipol.raw_store import InMemoryRawStore, RawMeta


@pytest.fixture
def demo(demo_tree):
    return load_source(demo_tree["sources"] / "1-demo")


def test_it_reads_the_vaults_folder_on_drive(demo, fake_fetch):
    copy_source(demo, InMemoryRawStore(), fake_fetch, drive_root="remote:Root")

    assert fake_fetch.calls == ["remote:Root/Demo/Sources/Transcripts"]


def test_every_raw_with_an_id_lands_under_it_bytes_unchanged(demo, demo_tree, fake_fetch):
    store = InMemoryRawStore()

    report = copy_source(demo, store, fake_fetch)

    assert store.list("demo") == ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"]
    for name, youtube_id in [
        ("Avec id.md", "aaaaaaaaaaa"),
        ("Avec url.md", "bbbbbbbbbbb"),
        ("Sans frontmatter.md", "ccccccccccc"),
        ("Lie par une fiche.md", "ddddddddddd"),
    ]:
        assert store.get("demo", youtube_id).body == (demo_tree["drive"] / name).read_bytes()
    assert report.on_drive == 5
    assert report.in_bucket == 4
    assert report.missing_id == ["Orphelin.md"]


def test_title_and_publication_date_ride_as_metadata(demo, fake_fetch):
    store = InMemoryRawStore()

    copy_source(demo, store, fake_fetch)

    assert store.get("demo", "aaaaaaaaaaa").meta == RawMeta("Avec id", date(2025, 7, 27))
    assert store.get("demo", "bbbbbbbbbbb").meta == RawMeta(
        "AVEC URL : LE VRAI TITRE !", date(2026, 3, 30)
    )
    assert store.get("demo", "ccccccccccc").meta == RawMeta("Sans frontmatter", date(2026, 4, 15))
    assert store.get("demo", "ddddddddddd").meta.published == date(2025, 8, 1)


def test_a_second_run_copies_nothing(demo, fake_fetch):
    store = InMemoryRawStore()
    copy_source(demo, store, fake_fetch)

    again = copy_source(demo, store, fake_fetch)

    assert again.copied == []
    assert len(again.already_there) == 4
    assert again.conflicts == []


def test_a_different_raw_already_in_the_bucket_is_a_conflict_left_alone(demo, fake_fetch):
    store = InMemoryRawStore()
    store.put("demo", "aaaaaaaaaaa", b"another text", RawMeta("x"))

    report = copy_source(demo, store, fake_fetch)

    assert report.conflicts == ["aaaaaaaaaaa"]
    assert store.get("demo", "aaaaaaaaaaa").body == b"another text"


def test_a_raw_another_writer_put_first_is_counted_not_raised(demo, fake_fetch):
    class RacingStore(InMemoryRawStore):
        def exists(self, source, youtube_id):
            return False  # as if the other writer landed right after this check

    store = RacingStore()
    copy_source(demo, store, fake_fetch)

    again = copy_source(demo, store, fake_fetch)

    assert again.copied == []
    assert len(again.already_there) == 4


def test_two_files_with_one_id_copy_the_first_and_list_the_second(demo, demo_tree, fake_fetch):
    (demo_tree["drive"] / "Avec id (copie).md").write_bytes(
        (demo_tree["drive"] / "Avec id.md").read_bytes()
    )
    store = InMemoryRawStore()

    report = copy_source(demo, store, fake_fetch)

    assert report.duplicates == ["Avec id.md (same id as Avec id (copie).md)"]
    assert store.exists("demo", "aaaaaaaaaaa")


def test_a_dry_run_writes_nothing(demo, fake_fetch):
    store = InMemoryRawStore()

    report = copy_source(demo, store, fake_fetch, dry_run=True)

    assert len(report.copied) == 4
    assert store.objects == {}


def test_a_source_without_a_vault_has_nothing_on_drive(tmp_path, fake_fetch):
    source = Source("Neuve", "neuve", tmp_path, legacy_vault=None, legacy_inventory=None)

    report = copy_source(source, InMemoryRawStore(), fake_fetch)

    assert drive_folder(source) is None
    assert report.on_drive == 0
    assert fake_fetch.calls == []


def test_the_report_counts_and_lists(demo, fake_fetch):
    report = copy_source(demo, InMemoryRawStore(), fake_fetch)

    text = format_report([report])

    assert text.splitlines()[0] == (
        "demo: 5 on Drive, 4 in the bucket (copied 4, 0 already there, 0 conflicts), "
        "0 duplicates, 1 without a YouTube id, 0 without a publication date"
    )
    assert "  no YouTube id, not copied: Orphelin.md" in text


def test_the_command_copies_every_source(demo_tree, fake_fetch, monkeypatch, capsys):
    store = InMemoryRawStore()
    monkeypatch.setattr(drive_copy, "rclone_copy", fake_fetch)
    monkeypatch.setattr(cli.S3RawStore, "from_settings", classmethod(lambda cls, s: store))
    monkeypatch.setenv("WIKIPOL_S3_BUCKET", "raws")
    monkeypatch.setenv("WIKIPOL_S3_ENDPOINT", "https://s3.example.test")
    monkeypatch.setenv("SCW_ACCESS_KEY", "fake")
    monkeypatch.setenv("SCW_SECRET_KEY", "fake")

    code = cli.main(["copy-from-drive", "--sources-dir", str(demo_tree["sources"])])

    assert code == 0
    assert len(store.list("demo")) == 4
    assert capsys.readouterr().out.startswith("demo: 5 on Drive")


def test_the_command_names_a_missing_variable(demo_tree, capsys):
    code = cli.main(["copy-from-drive", "--sources-dir", str(demo_tree["sources"])])

    assert code == 2
    assert "WIKIPOL_S3_BUCKET" in capsys.readouterr().err


def test_the_command_refuses_an_unknown_source(demo_tree, capsys):
    code = cli.main(
        ["copy-from-drive", "--sources-dir", str(demo_tree["sources"]), "--source", "nope"]
    )

    assert code == 2
    assert "nope" in capsys.readouterr().err


def test_a_failing_rclone_is_reported_not_raised(demo_tree, monkeypatch, capsys):
    def failing(remote, local):
        raise subprocess.CalledProcessError(3, ["rclone", "copy", remote, str(local)])

    monkeypatch.setattr(drive_copy, "rclone_copy", failing)
    monkeypatch.setattr(cli.S3RawStore, "from_settings", classmethod(lambda cls, s: None))
    monkeypatch.setenv("WIKIPOL_S3_BUCKET", "raws")
    monkeypatch.setenv("WIKIPOL_S3_ENDPOINT", "https://s3.example.test")
    monkeypatch.setenv("SCW_ACCESS_KEY", "fake")
    monkeypatch.setenv("SCW_SECRET_KEY", "fake")

    code = cli.main(["copy-from-drive", "--sources-dir", str(demo_tree["sources"])])

    assert code == 2
    assert "rclone exited with 3" in capsys.readouterr().err


def test_a_dry_run_report_says_the_bucket_count_is_projected(demo, fake_fetch):
    report = copy_source(demo, InMemoryRawStore(), fake_fetch, dry_run=True)

    assert "5 on Drive, 4 would be in the bucket (would copy 4," in format_report([report], True)

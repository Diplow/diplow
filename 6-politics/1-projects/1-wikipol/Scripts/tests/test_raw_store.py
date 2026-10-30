from datetime import date

import boto3
import pytest
from moto import mock_aws

from wikipol.raw_store import (
    InMemoryRawStore,
    RawExists,
    RawMeta,
    RawNotFound,
    S3RawStore,
    raw_key,
)

TITLE = "Liban : nouvel affront israélien à la France | Entretiens géopo"


@pytest.fixture(params=["memory", "s3"])
def store(request):
    """Both stores answer the same contract; S3 runs on moto, never on Scaleway."""
    if request.param == "memory":
        yield InMemoryRawStore()
        return
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket="raws")
        yield S3RawStore(client, "raws")


def test_a_raw_comes_back_as_it_went_in(store):
    body = "0:00\n\nÀ Gaza, l'été.\n".encode()

    store.put("boniface", "fgujm6YqeAw", body, RawMeta(TITLE, date(2026, 4, 17)))
    raw = store.get("boniface", "fgujm6YqeAw")

    assert raw.body == body
    assert raw.meta == RawMeta(TITLE, date(2026, 4, 17))


def test_a_raw_without_a_publication_date(store):
    store.put("paduteam", "ubfvCuQziRA", b"x", RawMeta("Sans date"))

    meta = store.get("paduteam", "ubfvCuQziRA").meta
    assert meta.published is None
    assert meta.duration is None


def test_a_fetched_raw_keeps_its_duration(store):
    meta = RawMeta("Une vidéo", date(2026, 10, 30), duration=1834)

    store.put("paduteam", "ubfvCuQziRA", b"x", meta)

    assert store.get("paduteam", "ubfvCuQziRA").meta == meta


def test_a_raw_is_never_replaced(store):
    store.put("paduteam", "ubfvCuQziRA", b"first", RawMeta("t"))

    with pytest.raises(RawExists):
        store.put("paduteam", "ubfvCuQziRA", b"second", RawMeta("t"))
    assert store.get("paduteam", "ubfvCuQziRA").body == b"first"


def test_exists_and_list_stay_within_a_source(store):
    store.put("paduteam", "bbbbbbbbbbb", b"b", RawMeta("b"))
    store.put("paduteam", "aaaaaaaaaaa", b"a", RawMeta("a"))
    store.put("boniface", "ccccccccccc", b"c", RawMeta("c"))

    assert store.list("paduteam") == ["aaaaaaaaaaa", "bbbbbbbbbbb"]
    assert store.list("boniface") == ["ccccccccccc"]
    assert store.exists("boniface", "ccccccccccc")
    assert not store.exists("paduteam", "ccccccccccc")


def test_a_missing_raw_is_not_found(store):
    with pytest.raises(RawNotFound):
        store.get("paduteam", "zzzzzzzzzzz")


def test_the_key_is_the_source_slug_and_the_youtube_id():
    assert raw_key("paduteam", "ubfvCuQziRA") == "paduteam/ubfvCuQziRA.md"


@pytest.mark.parametrize(
    ("source", "youtube_id"),
    [
        ("paduteam", "too-short"),
        ("paduteam", "../escape.md"),
        ("paduteam", "ubfvCuQziRA\n"),
        ("paduteam\n", "ubfvCuQziRA"),
        ("Padu Team", "ubfvCuQziRA"),
    ],
)
def test_a_malformed_key_is_refused(source, youtube_id):
    with pytest.raises(ValueError):
        raw_key(source, youtube_id)

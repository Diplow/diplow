"""The Raws' only home: one object per Publication, `<source-slug>/<youtube_id>.md`.

A Raw is written once and never replaced (`put` refuses an existing key), so copying is the only
move. On S3 the write itself carries the refusal (`If-None-Match: *`, which Scaleway honors), so
two writers racing on one key can't both win.

Its metadata holds what the key lost: the original title and, when known, the publication date
and the duration in seconds. S3 sends metadata as HTTP headers, which carry ASCII only, so the
title is percent-encoded on the wire and decoded on the way back.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import TYPE_CHECKING, Any, Protocol
from urllib.parse import quote, unquote

if TYPE_CHECKING:
    from wikipol.config import Settings

YOUTUBE_ID = re.compile(r"[A-Za-z0-9_-]{11}")
SLUG = re.compile(r"[a-z0-9][a-z0-9-]*")


class RawExists(Exception):
    """`put` was asked to replace a Raw. Raws are never overwritten."""


class RawNotFound(Exception):
    pass


@dataclass(frozen=True)
class RawMeta:
    title: str
    published: date | None = None
    duration: int | None = None
    """Seconds. The Fetcher knows it; a Raw copied from Drive doesn't."""


@dataclass(frozen=True)
class Raw:
    source: str
    youtube_id: str
    body: bytes
    meta: RawMeta


def raw_key(source: str, youtube_id: str) -> str:
    if not SLUG.fullmatch(source):
        raise ValueError(f"not a Source slug: {source!r}")
    if not YOUTUBE_ID.fullmatch(youtube_id):
        raise ValueError(f"not a YouTube id: {youtube_id!r}")
    return f"{source}/{youtube_id}.md"


class RawStore(Protocol):
    def put(self, source: str, youtube_id: str, body: bytes, meta: RawMeta) -> None: ...
    def get(self, source: str, youtube_id: str) -> Raw: ...
    def exists(self, source: str, youtube_id: str) -> bool: ...
    def list(self, source: str) -> list[str]: ...


class InMemoryRawStore:
    """The store the tests use: same contract, a dict for a bucket."""

    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, RawMeta]] = {}

    def put(self, source: str, youtube_id: str, body: bytes, meta: RawMeta) -> None:
        key = raw_key(source, youtube_id)
        if key in self.objects:
            raise RawExists(key)
        self.objects[key] = (body, meta)

    def get(self, source: str, youtube_id: str) -> Raw:
        key = raw_key(source, youtube_id)
        if key not in self.objects:
            raise RawNotFound(key)
        body, meta = self.objects[key]
        return Raw(source, youtube_id, body, meta)

    def exists(self, source: str, youtube_id: str) -> bool:
        return raw_key(source, youtube_id) in self.objects

    def list(self, source: str) -> list[str]:
        prefix = f"{source}/"
        return sorted(
            key.removeprefix(prefix).removesuffix(".md")
            for key in self.objects
            if key.startswith(prefix)
        )


class S3RawStore:
    """The Raws in an S3 bucket: Scaleway Object Storage in production."""

    def __init__(self, client: Any, bucket: str) -> None:
        self.client = client
        self.bucket = bucket

    @classmethod
    def from_settings(cls, settings: Settings) -> S3RawStore:
        import boto3
        from botocore.config import Config

        client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            # Recent botocore adds CRC checksums to every request by default; Scaleway's S3
            # API predates them, so send them only where the API requires one.
            config=Config(
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
            ),
        )
        return cls(client, settings.s3_bucket)

    def put(self, source: str, youtube_id: str, body: bytes, meta: RawMeta) -> None:
        from botocore.exceptions import ClientError

        key = raw_key(source, youtube_id)
        metadata = {"title": quote(meta.title, safe="")}
        if meta.published:
            metadata["published"] = meta.published.isoformat()
        if meta.duration is not None:
            metadata["duration"] = str(meta.duration)
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=body,
                ContentType="text/markdown; charset=utf-8",
                Metadata=metadata,
                IfNoneMatch="*",
            )
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code")
            if code in {"PreconditionFailed", "ConditionalRequestConflict", "412", "409"}:
                raise RawExists(key) from error
            raise

    def get(self, source: str, youtube_id: str) -> Raw:
        key = raw_key(source, youtube_id)
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=key)
        except self.client.exceptions.NoSuchKey as error:
            raise RawNotFound(key) from error
        metadata = response.get("Metadata", {})
        published, duration = metadata.get("published"), metadata.get("duration")
        meta = RawMeta(
            title=unquote(metadata.get("title", "")),
            published=date.fromisoformat(published) if published else None,
            duration=int(duration) if duration else None,
        )
        return Raw(source, youtube_id, response["Body"].read(), meta)

    def exists(self, source: str, youtube_id: str) -> bool:
        from botocore.exceptions import ClientError

        try:
            self.client.head_object(Bucket=self.bucket, Key=raw_key(source, youtube_id))
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
                return False
            raise
        return True

    def list(self, source: str) -> list[str]:
        prefix = f"{source}/"
        paginator = self.client.get_paginator("list_objects_v2")
        ids = []
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            for item in page.get("Contents", []):
                name = item["Key"].removeprefix(prefix)
                if name.endswith(".md") and "/" not in name:
                    ids.append(name.removesuffix(".md"))
        return sorted(ids)

"""Chunks into vectors, through Scaleway's Generative APIs (docs/adr/0003).

The model is `qwen3-embedding-8b`, a multilingual Matryoshka model: asked for EMBEDDING_DIMENSIONS
of its 4096 dimensions, it returns the most meaningful ones, and 1024 stays under the 2000 that
pgvector's HNSW index takes for a `vector` column. A chunk is embedded as it is; a search query,
on the other side (WIK-8), takes the model's `Instruct: …\\nQuery: …` prefix.

The API is OpenAI's embeddings endpoint. A busy or failing answer (429, 5xx, a dropped connection)
is retried with a growing pause; a refusal (401, 403) is not, since no wait will fix a key.
"""

from __future__ import annotations

import http.client
import json
import time
import urllib.error
import urllib.request
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Protocol

EMBEDDING_MODEL = "qwen3-embedding-8b"
EMBEDDING_DIMENSIONS = 1024
"""Also the size of the `chunk.embedding` column, in the index's migrations."""
API_ROOT = "https://api.scaleway.ai"
BATCH_SIZE = 16
"""Chunks per request: about 10 000 tokens, far under the model's 32k context per chunk."""
EUR_PER_MILLION_TOKENS = 0.10
"""qwen3-embedding-8b's price as listed on 2026-10-31 (third-party listings; the bill is in the
Scaleway console). Only the report's cost estimate reads it."""
TIMEOUT_SECONDS = 120
RETRY_PAUSES = (2, 5, 15, 30, 60)
RETRIED_STATUSES = {429, 500, 502, 503, 504}

HttpPost = Callable[[str, dict[str, str], bytes], tuple[int, bytes]]
"""POSTs a body to a URL with headers; returns the status and the body, whatever the status.
Raises OSError when no answer comes back."""


class EmbeddingFailed(Exception):
    """The API refused, or kept failing after every retry."""


@dataclass(frozen=True)
class Embeddings:
    vectors: list[list[float]]
    tokens: int
    """What the API counted, and bills."""


class Embedder(Protocol):
    model: str

    def embed(self, texts: Sequence[str]) -> Embeddings: ...


def http_post(url: str, headers: dict[str, str], body: bytes) -> tuple[int, bytes]:
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()
    except http.client.HTTPException as error:  # a body cut short
        raise OSError(f"{error!r}") from error


def cost_eur(tokens: int) -> float:
    return tokens / 1_000_000 * EUR_PER_MILLION_TOKENS


class ScalewayEmbedder:
    model = EMBEDDING_MODEL

    def __init__(
        self,
        api_key: str,
        project_id: str | None = None,
        post: HttpPost = http_post,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        # Under the project's path, the calls are billed to it rather than to the key's default.
        root = f"{API_ROOT}/{project_id}/v1" if project_id else f"{API_ROOT}/v1"
        self._url = f"{root}/embeddings"
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        self._post = post
        self._sleep = sleep

    def embed(self, texts: Sequence[str]) -> Embeddings:
        vectors: list[list[float]] = []
        tokens = 0
        for begin in range(0, len(texts), BATCH_SIZE):
            batch = self._embed_batch(list(texts[begin : begin + BATCH_SIZE]))
            vectors.extend(batch.vectors)
            tokens += batch.tokens
        return Embeddings(vectors, tokens)

    def _embed_batch(self, texts: list[str]) -> Embeddings:
        body = json.dumps(
            {
                "model": self.model,
                "input": texts,
                "dimensions": EMBEDDING_DIMENSIONS,
                "encoding_format": "float",
            }
        ).encode("utf-8")
        status, answer = 0, b""
        for pause in (*RETRY_PAUSES, None):
            try:
                status, answer = self._post(self._url, self._headers, body)
            except OSError as error:
                status, answer = 0, repr(error).encode()
            if status == 200:
                return parse_embeddings(answer, len(texts))
            if status in {401, 403}:
                raise EmbeddingFailed(
                    f"Generative APIs refused the key ({status}): the key in "
                    "WIKIPOL_EMBEDDING_API_KEY, else SCW_SECRET_KEY, needs the "
                    "GenerativeApisModelAccess permission"
                )
            if status and status not in RETRIED_STATUSES:
                break
            if pause is not None:
                self._sleep(pause)
        detail = answer[:200].decode("utf-8", "replace")
        raise EmbeddingFailed(f"Generative APIs answered {status or 'nothing'}: {detail}")


def parse_embeddings(answer: bytes, expected: int) -> Embeddings:
    """The vectors of an embeddings answer, in the order of the inputs."""
    try:
        payload = json.loads(answer)
        rows = sorted(payload["data"], key=lambda row: row["index"])
        vectors = [[float(x) for x in row["embedding"]] for row in rows]
        tokens = int(payload.get("usage", {}).get("total_tokens") or 0)
    except (ValueError, TypeError, KeyError, AttributeError) as error:
        raise EmbeddingFailed(f"an embeddings answer it can't read: {error!r}") from error
    if len(vectors) != expected:
        raise EmbeddingFailed(f"{len(vectors)} vectors for {expected} chunks")
    if any(len(vector) != EMBEDDING_DIMENSIONS for vector in vectors):
        raise EmbeddingFailed(f"a vector is not {EMBEDDING_DIMENSIONS}-dimensional")
    return Embeddings(vectors, tokens)

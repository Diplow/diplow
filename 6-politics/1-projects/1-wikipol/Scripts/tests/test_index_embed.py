"""The Generative APIs embedder on a fake HTTP post: batching, retries, refusals. No network."""

import json
import re

import pytest

from wikipol.index.embed import (
    BATCH_SIZE,
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    RETRY_PAUSES,
    EmbeddingFailed,
    ScalewayEmbedder,
)
from wikipol.index.store import migrations


class FakeApi:
    """Answers each POST with the next of `statuses` (200 once they run out), one vector per input
    whose first coordinate is the input's number, and 3 tokens per input."""

    def __init__(self, statuses=()):
        self.statuses = list(statuses)
        self.calls: list[tuple[str, dict, dict]] = []

    def post(self, url, headers, body):
        request = json.loads(body)
        self.calls.append((url, headers, request))
        status = self.statuses.pop(0) if self.statuses else 200
        if status != 200:
            return status, b'{"error": {"message": "busy"}}'
        data = [
            {
                "index": i,
                "embedding": [float(text.split()[-1])] + [0.0] * (request["dimensions"] - 1),
            }
            for i, text in reversed(list(enumerate(request["input"])))  # out of order on purpose
        ]
        usage = {"prompt_tokens": 3 * len(data), "total_tokens": 3 * len(data)}
        return 200, json.dumps({"data": data, "usage": usage}).encode()


def embedder(api, sleeps=None, project_id="proj-1"):
    return ScalewayEmbedder(
        "secret-key", project_id, post=api.post, sleep=(sleeps if sleeps is not None else []).append
    )


def test_chunks_are_sent_in_batches_and_come_back_in_order_with_their_tokens():
    api = FakeApi()
    texts = [f"chunk {n}" for n in range(BATCH_SIZE * 2 + 1)]
    result = embedder(api).embed(texts)
    assert [v[0] for v in result.vectors] == list(range(len(texts)))
    assert all(len(v) == EMBEDDING_DIMENSIONS for v in result.vectors)
    assert result.tokens == 3 * len(texts)
    assert [len(call[2]["input"]) for call in api.calls] == [BATCH_SIZE, BATCH_SIZE, 1]
    url, headers, request = api.calls[0]
    assert url == "https://api.scaleway.ai/proj-1/v1/embeddings"
    assert headers["Authorization"] == "Bearer secret-key"
    assert request["model"] == EMBEDDING_MODEL
    assert request["dimensions"] == EMBEDDING_DIMENSIONS


def test_without_a_project_the_default_endpoint_is_used():
    api = FakeApi()
    embedder(api, project_id=None).embed(["chunk 1"])
    assert api.calls[0][0] == "https://api.scaleway.ai/v1/embeddings"


def test_a_busy_api_is_retried_after_a_pause():
    api, sleeps = FakeApi([429, 503]), []
    result = embedder(api, sleeps).embed(["chunk 7"])
    assert result.vectors[0][0] == 7
    assert sleeps == list(RETRY_PAUSES[:2])


def test_an_api_busy_through_every_retry_fails():
    api, sleeps = FakeApi([429] * (len(RETRY_PAUSES) + 1)), []
    with pytest.raises(EmbeddingFailed, match="429"):
        embedder(api, sleeps).embed(["chunk 1"])
    assert sleeps == list(RETRY_PAUSES)


def test_a_search_s_embedder_gives_up_after_its_own_few_retries():
    api, sleeps = FakeApi([503, 503, 200]), []
    impatient = ScalewayEmbedder("k", post=api.post, sleep=sleeps.append, retry_pauses=(2,))
    with pytest.raises(EmbeddingFailed, match="503"):
        impatient.embed(["chunk 1"])
    assert sleeps == [2]
    assert len(api.calls) == 2


def test_a_dropped_connection_is_retried():
    calls = []

    def post(url, headers, body):
        calls.append(body)
        if len(calls) == 1:
            raise OSError("connection reset")
        return FakeApi().post(url, headers, body)

    sleeps = []
    result = ScalewayEmbedder("k", post=post, sleep=sleeps.append).embed(["chunk 2"])
    assert result.vectors[0][0] == 2
    assert sleeps == [RETRY_PAUSES[0]]


def test_a_refused_key_fails_at_once_naming_the_variables_not_the_key():
    api, sleeps = FakeApi([403]), []
    with pytest.raises(EmbeddingFailed) as failure:
        embedder(api, sleeps).embed(["chunk 1"])
    assert "WIKIPOL_EMBEDDING_API_KEY" in str(failure.value)
    assert "secret-key" not in str(failure.value)
    assert sleeps == []


def test_an_answer_with_the_wrong_vectors_fails():
    def short(url, headers, body):
        data = [{"index": 0, "embedding": [0.1, 0.2]}]
        return 200, json.dumps({"data": data}).encode()

    with pytest.raises(EmbeddingFailed, match="dimensional"):
        ScalewayEmbedder("k", post=short).embed(["chunk 1"])
    with pytest.raises(EmbeddingFailed, match="1 vectors for 2"):
        ScalewayEmbedder("k", post=short).embed(["a 1", "b 2"])

    def twice(url, headers, body):
        vector = [0.0] * EMBEDDING_DIMENSIONS
        data = [{"index": 0, "embedding": vector}, {"index": 0, "embedding": vector}]
        return 200, json.dumps({"data": data}).encode()

    with pytest.raises(EmbeddingFailed, match="not 0 to 1"):
        ScalewayEmbedder("k", post=twice).embed(["a 1", "b 2"])


def test_the_chunk_column_holds_the_vectors_the_embedder_asks_for():
    schema = "\n".join(sql for _, sql in migrations())
    assert re.findall(r"embedding\s+vector\((\d+)\)", schema) == [str(EMBEDDING_DIMENSIONS)]
    assert "CREATE EXTENSION IF NOT EXISTS vector" in schema

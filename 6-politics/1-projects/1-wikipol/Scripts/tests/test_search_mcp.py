"""The MCP server, driven through its streams as a client would over stdio: the handshake, the
tool's listing, a search on an in-memory index, and what it answers when a search fails. Then
`wikipol mcp` itself, started as a process with no settings at all."""

import io
import json
import os
import subprocess
import sys
from datetime import date

import pytest
from test_search_extracts import SOURCES, TopicEmbedder, index_with, publication

from wikipol.index.embed import EmbeddingFailed
from wikipol.search.extracts import SearchFailed, find_extracts
from wikipol.search.mcp import PROTOCOL_VERSIONS, Server


def exchange(server: Server, *messages) -> list[dict]:
    lines = [m if isinstance(m, str) else json.dumps(m) for m in messages]
    stdout = io.StringIO()
    server.serve(io.StringIO("\n".join(lines) + "\n"), stdout)
    return [json.loads(line) for line in stdout.getvalue().splitlines()]


def request(request_id, method, params=None):
    message = {"jsonrpc": "2.0", "id": request_id, "method": method}
    return message if params is None else {**message, "params": params}


def call(request_id, arguments):
    return request(request_id, "tools/call", {"name": "search", "arguments": arguments})


@pytest.fixture
def server():
    index = index_with(
        (
            publication("paduteam", "retraite025", date(2025, 3, 14), "6-politics/x/1-a.md"),
            [(750, "la réforme des retraites")],
        ),
        (publication("boniface", "gazagaza025", date(2025, 6, 2)), [(90, "gaza à l'ONU")]),
    )

    def search(query, **options):
        return find_extracts(query, TopicEmbedder(), index, sources=SOURCES, **options)

    return Server(search, SOURCES)


def test_the_handshake_agrees_on_a_revision_and_offers_one_read_only_tool(server):
    init, tools = exchange(
        server,
        request(1, "initialize", {"protocolVersion": "2025-03-26", "capabilities": {}}),
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        request(2, "tools/list"),
    )

    assert init["id"] == 1
    assert init["result"]["protocolVersion"] == "2025-03-26"
    assert init["result"]["capabilities"] == {"tools": {"listChanged": False}}
    assert init["result"]["serverInfo"]["name"] == "wikipol"
    [tool] = tools["result"]["tools"]
    assert tool["name"] == "search"
    assert tool["inputSchema"]["required"] == ["query"]
    assert set(tool["inputSchema"]["properties"]) == {"query", "source", "from", "to", "limit"}
    assert tool["inputSchema"]["properties"]["source"]["enum"] == list(SOURCES)
    assert tool["annotations"]["readOnlyHint"] is True


def test_a_client_asking_for_an_unknown_revision_is_offered_the_newest(server):
    [init] = exchange(server, request(1, "initialize", {"protocolVersion": "1999-01-01"}))

    assert init["result"]["protocolVersion"] == PROTOCOL_VERSIONS[0]


def test_a_search_answers_extracts_as_json_text(server):
    [answer] = exchange(
        server,
        call(7, {"query": "retraites", "source": "paduteam", "from": "2025-03", "to": "2025"}),
    )

    result = answer["result"]
    assert answer["id"] == 7 and result["isError"] is False
    [extract] = json.loads(result["content"][0]["text"])["extracts"]
    assert extract == {
        "passage": "la réforme des retraites",
        "url": "https://www.youtube.com/watch?v=retraite025&t=750s",
        "at": "12:30",
        "title": "Titre de retraite025",
        "published": "2025-03-14",
        "digest": "6-politics/x/1-a.md",
        "source": "paduteam",
        "similarity": extract["similarity"],
    }


def test_the_answer_is_one_utf8_line_per_message(server):
    stdout = io.StringIO()
    server.serve(io.StringIO(json.dumps(call(1, {"query": "gaza"})) + "\n"), stdout)

    [line] = stdout.getvalue().splitlines()
    assert "gaza à l'ONU" in line


@pytest.mark.parametrize(
    ("arguments", "message"),
    [
        ({"query": "x", "source": "inconnue"}, "no Source 'inconnue'"),
        ({"query": "x", "from": "hier"}, "'hier' is not a date"),
        ({"query": "x", "limit": "5"}, "limit must be an integer"),
        ({"query": "x", "limit": True}, "limit must be an integer"),
        ({"query": 3}, "query must be a string"),
        ({"query": "x", "to": 2025}, "source, from and to must be strings"),
        ({"query": "x", "period": "2025"}, "unknown arguments: period"),
        ({}, "query must be a string"),
    ],
)
def test_a_search_that_fails_is_a_tool_error_the_agent_reads(server, arguments, message):
    [answer] = exchange(server, call(3, arguments))

    assert answer["result"]["isError"] is True
    assert message in answer["result"]["content"][0]["text"]


def test_a_failing_index_or_api_is_a_tool_error_and_the_server_keeps_serving():
    def search(query, **options):
        raise SearchFailed("the query could not be embedded: Generative APIs refused the key")

    failed, pong = exchange(Server(search, SOURCES), call(1, {"query": "x"}), request(2, "ping"))

    assert failed["result"]["isError"] is True
    assert "refused the key" in failed["result"]["content"][0]["text"]
    assert pong == {"jsonrpc": "2.0", "id": 2, "result": {}}


def test_a_bug_is_an_internal_error_and_the_server_keeps_serving(capsys):
    def search(query, **options):
        raise EmbeddingFailed("not translated: a bug in the wiring")

    bug, pong = exchange(Server(search, SOURCES), call(1, {"query": "x"}), request(2, "ping"))

    assert bug["error"]["code"] == -32603
    assert "EmbeddingFailed" in bug["error"]["message"]
    assert pong["result"] == {}
    assert "Traceback" in capsys.readouterr().err


def test_protocol_mistakes_get_json_rpc_errors(server):
    answers = exchange(
        server,
        "{not json",
        json.dumps([request(1, "ping")]),
        request(2, "resources/list"),
        request(3, "tools/call", {"name": "fetch", "arguments": {}}),
        request(4, "tools/call", ["search"]),
    )

    assert [a["error"]["code"] for a in answers] == [-32700, -32600, -32601, -32602, -32602]
    assert [a["id"] for a in answers] == [None, None, 2, 3, 4]


def test_notifications_and_client_responses_get_no_answer(server):
    answers = exchange(
        server,
        {"jsonrpc": "2.0", "method": "notifications/cancelled", "params": {"requestId": 1}},
        {"jsonrpc": "2.0", "id": 9, "result": {}},
        "",
    )

    assert answers == []


def test_wikipol_mcp_starts_without_settings_and_says_what_is_missing(demo_tree):
    """The real entry point, as `.mcp.json` starts it. The test's environment holds no setting
    (conftest), so the search stops at the configuration, before any connection."""
    messages = [
        request(1, "initialize", {"protocolVersion": "2025-06-18"}),
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        request(2, "tools/list"),
        call(3, {"query": "la réforme des retraites", "from": "2025", "to": "2025"}),
    ]
    stdin = "".join(json.dumps(m) + "\n" for m in messages)

    done = subprocess.run(
        [sys.executable, "-m", "wikipol.cli", "mcp", "--sources-dir", str(demo_tree["sources"])],
        input=stdin.encode(),
        capture_output=True,
        timeout=60,
        env={**os.environ, "PYTHONIOENCODING": "ascii"},
        check=True,
    )

    init, tools, searched = (json.loads(line) for line in done.stdout.decode().splitlines())
    assert init["result"]["protocolVersion"] == "2025-06-18"
    assert tools["result"]["tools"][0]["inputSchema"]["properties"]["source"]["enum"] == ["demo"]
    assert searched["result"]["isError"] is True
    assert "WIKIPOL_DATABASE_URL is not set" in searched["result"]["content"][0]["text"]

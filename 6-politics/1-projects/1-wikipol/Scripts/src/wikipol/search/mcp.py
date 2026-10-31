"""The search as an MCP server over stdio: one tool, `search`, for any agent working on the
political hexframes.

MCP's stdio transport is JSON-RPC 2.0, one message per line on stdin and stdout; stdout carries
nothing else. The server answers `initialize`, `ping`, `tools/list` and `tools/call`, and ignores
notifications. It is written here rather than on the `mcp` SDK because the SDK is asyncio, and an
asyncio loop opens a socket pair the test gate's `--disable-socket` refuses: this one is plain
synchronous code the tests drive through its streams (decisions.md#DEC-22).

A search that fails (a refused question, a missing setting, an unreachable database or embedding
API) is a tool result with `isError`, its message for the agent to read. Anything else is a bug,
answered as JSON-RPC's internal error with its traceback on stderr. Either way the server keeps
serving.
"""

from __future__ import annotations

import json
import sys
import traceback
from collections.abc import Callable, Sequence
from importlib.metadata import version
from typing import IO, Any

from wikipol.search.extracts import DEFAULT_LIMIT, MAX_LIMIT, Extract, SearchFailed

PROTOCOL_VERSIONS = ("2025-06-18", "2024-11-05")
"""The MCP revisions this server speaks, newest first; a client asking for another gets the
newest, and decides. Not 2025-03-26, the one revision that requires JSON-RPC batches."""
TOOL = "search"

Search = Callable[..., list[Extract]]
"""`search(query, source=None, start=None, end=None, limit=None)`: the Extracts, nearest first.
Raises SearchFailed with a message for the agent; anything else is a bug."""


class ProtocolError(Exception):
    def __init__(self, code: int, message: str) -> None:
        super().__init__(message)
        self.code = code


# JSON-RPC's error codes.
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603


def tool_definition(sources: Sequence[str]) -> dict[str, Any]:
    return {
        "name": TOOL,
        "title": "Search the Sources",
        "description": (
            "Find what wikipol's Sources (political YouTube channels) said about a subject, "
            "optionally over a period. Returns Extracts, nearest first: the passage of the "
            "transcript (about two minutes of speech, in French), its link into the video at "
            "that moment, the Publication's title and date, and the repo path of its Digest when "
            "the Chronicle holds one. A Publication without a known date is only found by a "
            "search without `from` and `to`."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The subject, in a few words or a question, best in French: "
                    "« la réforme des retraites », « que pensent-ils de la NUPES ? »",
                },
                "source": {
                    "type": "string",
                    "enum": list(sources),
                    "description": "Only this Source's Publications; every Source when absent.",
                },
                "from": {
                    "type": "string",
                    "description": "The period's first day: 2025, 2025-03 or 2025-03-14; a year "
                    "or a month starts on its first day.",
                },
                "to": {
                    "type": "string",
                    "description": "The period's last day: 2025, 2025-03 or 2025-03-14; a year "
                    "or a month ends on its last day.",
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": MAX_LIMIT,
                    "default": DEFAULT_LIMIT,
                    "description": "How many Extracts to return.",
                },
            },
            "required": ["query"],
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    }


class Server:
    def __init__(self, search: Search, sources: Sequence[str]) -> None:
        self._search = search
        self._tool = tool_definition(sources)

    def serve(self, stdin: IO[str] = sys.stdin, stdout: IO[str] = sys.stdout) -> None:
        """Answer each request read from `stdin` on `stdout`, until `stdin` closes."""
        for line in stdin:
            if not line.strip():
                continue
            answer = self.handle(line)
            if answer is not None:
                stdout.write(json.dumps(answer, ensure_ascii=False) + "\n")
                stdout.flush()

    def handle(self, line: str) -> dict[str, Any] | None:
        """The answer to one message, None for a notification or a client's response."""
        try:
            message = json.loads(line)
        except ValueError:
            return error_answer(None, PARSE_ERROR, "not JSON")
        if not isinstance(message, dict) or not isinstance(message.get("method"), str):
            if isinstance(message, dict) and "method" not in message:
                return None  # a response to a request this server never sends
            return error_answer(None, INVALID_REQUEST, "not a JSON-RPC request")
        if "id" not in message:
            return None
        request_id = message["id"]
        if message.get("jsonrpc") != "2.0":
            return error_answer(request_id, INVALID_REQUEST, "not a JSON-RPC 2.0 request")
        params = message.get("params", {})
        try:
            if not isinstance(params, dict):
                raise ProtocolError(INVALID_PARAMS, "params must be an object")
            result = self._dispatch(message["method"], params)
        except ProtocolError as error:
            return error_answer(request_id, error.code, str(error))
        except Exception as error:  # a bug: say so, and keep serving
            traceback.print_exc(file=sys.stderr)
            return error_answer(request_id, INTERNAL_ERROR, f"{type(error).__name__}: {error}")
        return {"jsonrpc": "2.0", "id": request_id, "result": result}

    def _dispatch(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        if method == "initialize":
            asked = params.get("protocolVersion")
            return {
                "protocolVersion": asked if asked in PROTOCOL_VERSIONS else PROTOCOL_VERSIONS[0],
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {"name": "wikipol", "version": version("wikipol")},
            }
        if method == "ping":
            return {}
        if method == "tools/list":
            return {"tools": [self._tool]}
        if method == "tools/call":
            if params.get("name") != TOOL:
                raise ProtocolError(INVALID_PARAMS, f"no tool {params.get('name')!r}")
            return self._call(params.get("arguments") or {})
        raise ProtocolError(METHOD_NOT_FOUND, f"no method {method!r}")

    def _call(self, arguments: Any) -> dict[str, Any]:
        if not isinstance(arguments, dict):
            return tool_error("the arguments must be an object")
        known = self._tool["inputSchema"]["properties"]
        unknown = sorted(set(arguments) - set(known))
        if unknown:
            return tool_error(f"unknown arguments: {', '.join(unknown)}")
        query, limit = arguments.get("query"), arguments.get("limit")
        if not isinstance(query, str):
            return tool_error("query must be a string")
        if limit is not None and (isinstance(limit, bool) or not isinstance(limit, int)):
            return tool_error("limit must be an integer")
        texts = {name: arguments.get(name) for name in ("source", "from", "to")}
        if any(value is not None and not isinstance(value, str) for value in texts.values()):
            return tool_error("source, from and to must be strings")
        try:
            extracts = self._search(
                query,
                source=texts["source"],
                start=texts["from"],
                end=texts["to"],
                limit=limit,
            )
        except SearchFailed as error:
            return tool_error(str(error))
        payload = {"extracts": [extract.as_json() for extract in extracts]}
        return {
            "content": [
                {"type": "text", "text": json.dumps(payload, ensure_ascii=False, indent=1)}
            ],
            "isError": False,
        }


def tool_error(message: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": message}], "isError": True}


def error_answer(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}

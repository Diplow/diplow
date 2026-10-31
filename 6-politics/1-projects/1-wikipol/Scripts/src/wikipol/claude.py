"""`claude -p`, as the pipeline's skills run it: one skill, one prompt, one pinned model.

`write-digest` and `write-period` share it. Each returns a draft in one shape, a frontmatter
holding the `preview` and then a Body, which `split_draft` takes apart; the caller checks it.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Protocol

from wikipol.digest.format import split_digest

CLAUDE_TIMEOUT_SECONDS = 20 * 60

Run = Callable[[Sequence[str], str, Path, int], "subprocess.CompletedProcess[str]"]
"""Runs a command with its stdin, working folder and timeout in seconds, capturing text."""


class WriterFailed(Exception):
    """`claude -p` gave no draft: it failed, timed out, or answered with another model."""


class Writer(Protocol):
    def __call__(self, skill: str, prompt: str, model: str) -> str:
        """The draft `model` writes, following `skill`, from `prompt`."""
        ...


def run_command(
    command: Sequence[str], stdin: str, cwd: Path, timeout: int
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command, input=stdin, cwd=cwd, capture_output=True, text=True, timeout=timeout, check=False
    )


class ClaudeCli:
    """`claude -p` on the subscription: the skill as its system prompt, no tool, no MCP server,
    no session kept, run from an empty folder so no project's CLAUDE.md or hook joins in."""

    def __init__(self, run: Run = run_command, executable: str = "claude") -> None:
        self.run, self.executable = run, executable

    def __call__(self, skill: str, prompt: str, model: str) -> str:
        command = [
            self.executable,
            "-p",
            "--model",
            model,
            "--system-prompt",
            skill,
            "--tools",
            "",
            "--strict-mcp-config",
            "--disable-slash-commands",
            "--no-session-persistence",
            "--output-format",
            "json",
        ]
        with tempfile.TemporaryDirectory(prefix="wikipol-claude-") as folder:
            try:
                result = self.run(command, prompt, Path(folder), CLAUDE_TIMEOUT_SECONDS)
            except subprocess.TimeoutExpired as error:
                raise WriterFailed(f"claude timed out after {CLAUDE_TIMEOUT_SECONDS} s") from error
        try:
            answer = json.loads(result.stdout)
        except json.JSONDecodeError as error:
            raise WriterFailed(
                f"claude exited with {result.returncode}, no JSON answer: "
                f"{(result.stderr or result.stdout).strip()[-300:]}"
            ) from error
        if not isinstance(answer, dict):
            raise WriterFailed(f"claude answered {type(answer).__name__}, not a JSON object")
        if result.returncode != 0 or answer.get("is_error") or "result" not in answer:
            raise WriterFailed(f"claude failed: {str(answer.get('result', ''))[:300]}")
        used = set(answer.get("modelUsage") or {})
        if used and not any(name == model or name.startswith(f"{model}[") for name in used):
            raise WriterFailed(f"claude answered with {', '.join(sorted(used))}, not {model}")
        return str(answer["result"])


def split_draft(draft: str) -> tuple[str, str]:
    """The Preview and the Body of a draft; a code fence or a title heading around them goes."""
    text = draft.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.rsplit("```", 1)[0].strip()
    frontmatter, body = split_digest(text + "\n")
    preview = str((frontmatter or {}).get("preview") or "")
    body = body.strip()
    if body.startswith("# "):
        body = body.split("\n", 1)[1] if "\n" in body else ""
    return " ".join(preview.split()), body.strip()


def retry_prompt(prompt: str, draft: str, problems: list[str]) -> str:
    listed = "\n".join(f"- {problem}" for problem in problems)
    return (
        f"{prompt}\n\n# Ta version précédente, refusée par le validateur\n\n"
        f"Le validateur a relevé :\n\n{listed}\n\nTa version :\n\n{draft}\n\n"
        "Réécris le document entier en corrigeant chacun de ces points."
    )

"""The runner's clone, and how a run's Digests reach the base branch: one branch and one pull
request per run, merged by the run itself.

The clone is dedicated (`~/wikipol-runner`, set up by `install-runner.sh`), never a folder a human
edits, and git config `wikipol.runner` marks it. Between two runs it sits on the base branch. A run
fast-forwards it, lets the steps write, then commits what they wrote on `wikipol/run-<stamp>`,
pushes it through `gh auth git-credential`, opens a pull request into the base branch with `gh` and
merges it (`--squash`). When nothing changed, there is no branch and no pull request.

Nothing written is ever lost to a failure. When a push, the pull request or its merge fails, the
run takes its commit back into the working tree on the base branch, closes what it opened, and the
next run carries those files in its own commit. A run killed while publishing leaves its branch
checked out; the next run does the same with it, unless its pull request was merged.
"""

from __future__ import annotations

import contextlib
import fcntl
import json
import subprocess
import tempfile
from collections.abc import Callable, Iterator, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

RUN_BRANCH_PREFIX = "wikipol/run-"
RUNNER_MARK = "wikipol.runner"
COMMAND_TIMEOUT_SECONDS = 300
# gh's own credential helper, for this push only: the keychain's token may lack a scope.
GH_CREDENTIALS = ("-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential")

Run = Callable[[Sequence[str], Path], "subprocess.CompletedProcess[str]"]
"""Runs a command in a folder, capturing its output as text."""


class GitFailed(Exception):
    """git or gh refused: the command and the last lines it printed, never a credential."""


def run_command(command: Sequence[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=COMMAND_TIMEOUT_SECONDS,
        check=False,
    )


def tail(text: str, lines: int = 3) -> str:
    kept = [line for line in text.strip().splitlines() if line.strip()]
    return " / ".join(kept[-lines:])[:400] or "no output"


class Git:
    def __init__(self, root: Path, run: Run = run_command) -> None:
        self.root, self.run = root, run

    def __call__(self, *args: str) -> str:
        return self.command("git", *args)

    def command(self, *command: str) -> str:
        try:
            result = self.run(command, self.root)
        except subprocess.TimeoutExpired as error:
            raise GitFailed(f"{' '.join(command[:3])} timed out") from error
        except OSError as error:  # gh or git missing from launchd's PATH, most likely
            raise GitFailed(f"{command[0]} could not start: {error}") from error
        if result.returncode != 0:
            raise GitFailed(
                f"{' '.join(command[:3])} exited with {result.returncode}: "
                f"{tail(result.stderr or result.stdout)}"
            )
        return result.stdout

    def branch(self) -> str:
        return self("rev-parse", "--abbrev-ref", "HEAD").strip()

    def changes(self) -> list[str]:
        """The paths the working tree changed, untracked files included, unquoted: Digests'
        names carry accents."""
        fields = iter(self("status", "--porcelain", "-z", "--untracked-files=all").split("\0"))
        paths = []
        for entry in fields:
            if not entry:
                continue
            paths.append(entry[3:])
            if entry[0] in "RC":  # a staged rename or copy: its source path comes next
                next(fields, None)
        return paths

    @contextlib.contextmanager
    def locked(self) -> Iterator[None]:
        """Holds the clone for one run: launchd's catch-up after a sleep and a run started by hand
        must not write the same tree. Raises GitFailed when another run holds it."""
        path = Path(self("rev-parse", "--absolute-git-dir").strip()) / "wikipol-run.lock"
        try:
            lock = path.open("w")
        except OSError as error:
            raise GitFailed(f"{path} can't be opened: {error}") from error
        with lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as error:
                raise GitFailed(f"another run holds {path}") from error
            yield

    def is_runner(self) -> bool:
        try:
            return self("config", "--bool", RUNNER_MARK).strip() == "true"
        except GitFailed:  # unset: git config exits with 1
            return False


class GitHub(Protocol):
    def open_pull_request(self, base: str, head: str, title: str, body: str) -> str:
        """The new pull request's URL. Raises GitFailed."""
        ...

    def merge(self, url: str) -> None: ...

    def close(self, url: str) -> None: ...

    def merged(self, head: str) -> bool:
        """Whether a pull request from `head` was merged."""
        ...


class GhCli:
    """GitHub through `gh`, run in the clone so it knows the repository."""

    def __init__(self, git: Git) -> None:
        self.git = git

    def open_pull_request(self, base: str, head: str, title: str, body: str) -> str:
        with tempfile.NamedTemporaryFile("w", suffix=".md", encoding="utf-8") as file:
            file.write(body)
            file.flush()
            try:
                out = self.git.command(
                    "gh", "pr", "create", "--base", base, "--head", head,
                    "--title", title, "--body-file", file.name,
                )  # fmt: skip
            except GitFailed:
                # gh may fail after GitHub created it: look before calling it a failure.
                found = self._pull_requests(head, "open")
                if not found:
                    raise
                return found[0]["url"]
        return out.strip().splitlines()[-1]

    def merge(self, url: str) -> None:
        # No --delete-branch: in a clone, gh would also switch branches and delete the local one.
        self.git.command("gh", "pr", "merge", url, "--squash")

    def close(self, url: str) -> None:
        self.git.command("gh", "pr", "close", url, "--comment", "The run failed; next run retries.")

    def merged(self, head: str) -> bool:
        return bool(self._pull_requests(head, "merged"))

    def _pull_requests(self, head: str, state: str) -> list[dict[str, str]]:
        out = self.git.command(
            "gh", "pr", "list", "--head", head, "--state", state, "--json", "url,state"
        )
        try:
            return json.loads(out or "[]")
        except json.JSONDecodeError as error:
            raise GitFailed(f"gh pr list answered no JSON: {tail(out)}") from error


@dataclass
class RunnerRepo:
    """The runner's clone and the base branch its runs land on."""

    git: Git
    github: GitHub
    base: str = "main"

    def prepare(self, log: Callable[[str], None] = lambda _: None) -> list[str]:
        """Brings the clone onto an up-to-date base branch. Returns the files a stopped run left
        changed, which this run's commit will carry. Raises GitFailed when the clone isn't the
        runner's or the base can't be fast-forwarded."""
        if not self.git.is_runner():
            raise GitFailed(
                f"{self.git.root} is not the runner's clone (git config {RUNNER_MARK} is not "
                "true); install-runner.sh sets one up, never in a folder a human edits"
            )
        self.git("fetch", "origin", "--prune")
        branch = self.git.branch()
        if branch.startswith(RUN_BRANCH_PREFIX):
            self._recover(branch, log)
        elif branch != self.base:
            raise GitFailed(f"the runner's clone is on {branch}, not {self.base}")
        self.git("merge", "--ff-only", f"origin/{self.base}")
        return self.git.changes()

    def _recover(self, branch: str, log: Callable[[str], None]) -> None:
        """A run killed while publishing left its branch checked out."""
        if self.github.merged(branch):
            log(f"{branch}: merged by a run that stopped after; back to {self.base}")
            self.git("switch", self.base)
        else:
            log(f"{branch}: never merged; its files go back to the working tree")
            self._take_back(branch)
            self._discard_remote(branch)
        self.git("branch", "-D", branch)

    def _take_back(self, branch: str) -> None:
        """Undoes the run's commit, keeping its files changed, and returns to the base branch."""
        self.git("reset", "--soft", self.git("merge-base", "HEAD", self.base).strip())
        self.git("switch", self.base)

    def _discard_remote(self, branch: str, url: str | None = None) -> None:
        """Closes the run's pull request, when it opened one, and deletes its pushed branch.
        Either may not exist, or GitHub may be down: a stale branch harms nothing."""
        if url:
            with contextlib.suppress(GitFailed):
                self.github.close(url)
        with contextlib.suppress(GitFailed):
            self._push("origin", "--delete", branch)

    def _push(self, *args: str) -> None:
        self.git.command("git", *GH_CREDENTIALS, "push", "--quiet", *args)

    def publish(self, branch: str, title: str, body: str) -> str:
        """Commits every change on `branch`, opens its pull request into the base and merges it.
        Returns the pull request's URL. Raises GitFailed with the changes back in the tree."""
        self.git("switch", "-c", branch)
        url = None
        try:
            self.git("add", "-A")
            self.git("commit", "--quiet", "-m", title, "-m", body)
            self._push("-u", "origin", branch)
            url = self.github.open_pull_request(self.base, branch, title, body)
            self.github.merge(url)
        except GitFailed:
            self._take_back(branch)
            self._discard_remote(branch, url)
            self.git("branch", "-D", branch)
            raise
        self._discard_remote(branch)  # merged: the branch's work is on the base
        self.git("switch", self.base)
        self.git("branch", "-D", branch)
        with contextlib.suppress(GitFailed):  # else the next run's prepare fast-forwards it
            self.git("fetch", "origin")
            self.git("merge", "--ff-only", f"origin/{self.base}")
        return url

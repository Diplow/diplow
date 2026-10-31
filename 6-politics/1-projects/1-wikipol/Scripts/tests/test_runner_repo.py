"""The runner's clone on real git, against a bare repo standing in for GitHub's, and a fake `gh`
that merges with --squash as GitHub does: no network."""

from __future__ import annotations

from pathlib import Path

import pytest
from conftest import FakeGitHub, git

from wikipol.runner.repo import RUN_BRANCH_PREFIX, Git, GitFailed, RunnerRepo


@pytest.fixture
def remote(tmp_path):
    """A bare remote whose main holds one Chronicle file."""
    seed = tmp_path / "seed"
    seed.mkdir()
    git(seed, "init", "--quiet")
    (seed / "chronicle.md").write_text("one\n")
    git(seed, "add", ".")
    git(seed, "commit", "--quiet", "-m", "seed")
    bare = tmp_path / "remote.git"
    git(tmp_path, "clone", "--quiet", "--bare", str(seed), bare.name)
    return bare


@pytest.fixture
def clone(tmp_path, remote):
    path = tmp_path / "runner"
    git(tmp_path, "clone", "--quiet", str(remote), path.name)
    git(path, "config", "wikipol.runner", "true")
    return path


@pytest.fixture
def github(tmp_path, remote):
    return FakeGitHub(remote, tmp_path / "scratch")


def runner(clone: Path, github: FakeGitHub) -> RunnerRepo:
    return RunnerRepo(Git(clone), github, "main")


def remote_file(remote: Path, name: str) -> str:
    return git(remote, "show", f"main:{name}")


def remote_branches(remote: Path) -> list[str]:
    return git(remote, "branch", "--format=%(refname:short)").split()


def test_prepare_refuses_a_clone_not_marked_as_the_runners(clone, github):
    git(clone, "config", "--unset", "wikipol.runner")

    with pytest.raises(GitFailed, match="not the runner's clone"):
        runner(clone, github).prepare()


def test_prepare_fast_forwards_the_base_and_returns_what_a_stopped_run_left(
    tmp_path, remote, clone, github
):
    pusher = tmp_path / "pusher"
    git(tmp_path, "clone", "--quiet", str(remote), pusher.name)
    (pusher / "other.md").write_text("from a human\n")
    git(pusher, "add", ".")
    git(pusher, "commit", "--quiet", "-m", "elsewhere")
    git(pusher, "push", "--quiet", "origin", "main")
    (clone / "chronicle.md").write_text("one\ntwo, filed by a stopped run\n")

    leftovers = runner(clone, github).prepare()

    assert (clone / "other.md").read_text() == "from a human\n"
    assert leftovers == ["chronicle.md"]


def test_prepare_refuses_a_clone_on_another_branch(clone, github):
    git(clone, "switch", "--quiet", "-c", "someone/else")

    with pytest.raises(GitFailed, match="on someone/else, not main"):
        runner(clone, github).prepare()


def test_publish_merges_one_pull_request_and_leaves_the_clone_clean_on_the_base(
    remote, clone, github
):
    (clone / "chronicle.md").write_text("one\ntwo\n")
    (clone / "new digest.md").write_text("a Digest\n")
    branch = f"{RUN_BRANCH_PREFIX}2026-10-31-070000"

    url = runner(clone, github).publish(branch, "wikipol: daily run", "the summary")

    assert url == "https://github.com/Diplow/diplow/pull/1"
    assert github.opened == [("main", branch, "wikipol: daily run", "the summary")]
    assert remote_file(remote, "new digest.md") == "a Digest"
    assert remote_file(remote, "chronicle.md") == "one\ntwo"
    assert branch not in remote_branches(remote)
    assert git(clone, "rev-parse", "--abbrev-ref", "HEAD") == "main"
    assert git(clone, "status", "--porcelain") == ""
    assert git(clone, "rev-parse", "HEAD") == git(remote, "rev-parse", "main")
    assert branch not in git(clone, "branch", "--format=%(refname:short)").split()


@pytest.mark.parametrize("fail_on", ["open", "merge"])
def test_a_failed_publish_puts_the_files_back_on_the_base_and_closes_what_it_opened(
    tmp_path, remote, clone, fail_on
):
    github = FakeGitHub(remote, tmp_path / "scratch", fail_on=fail_on)
    (clone / "new digest.md").write_text("a Digest\n")
    branch = f"{RUN_BRANCH_PREFIX}2026-10-31-070000"

    with pytest.raises(GitFailed):
        runner(clone, github).publish(branch, "wikipol: daily run", "the summary")

    assert git(clone, "rev-parse", "--abbrev-ref", "HEAD") == "main"
    assert (clone / "new digest.md").read_text() == "a Digest\n"
    assert Git(clone).changes() == ["new digest.md"]
    assert git(clone, "rev-parse", "HEAD") == git(remote, "rev-parse", "main")
    assert branch not in remote_branches(remote)
    assert github.closed == (
        [] if fail_on == "open" else ["https://github.com/Diplow/diplow/pull/1"]
    )

    # The next run carries them.
    retry = FakeGitHub(remote, tmp_path / "scratch")
    assert runner(clone, retry).prepare() == ["new digest.md"]
    runner(clone, retry).publish(f"{RUN_BRANCH_PREFIX}2026-11-01-070000", "next", "body")
    assert remote_file(remote, "new digest.md") == "a Digest"


def test_a_run_killed_before_its_merge_gives_its_files_back_to_the_next(remote, clone, github):
    branch = f"{RUN_BRANCH_PREFIX}2026-10-31-070000"
    git(clone, "switch", "--quiet", "-c", branch)
    (clone / "new digest.md").write_text("a Digest\n")
    git(clone, "add", ".")
    git(clone, "commit", "--quiet", "-m", "killed after this")
    git(clone, "push", "--quiet", "origin", branch)

    leftovers = runner(clone, github).prepare()

    assert leftovers == ["new digest.md"]
    assert git(clone, "rev-parse", "--abbrev-ref", "HEAD") == "main"
    assert branch not in git(clone, "branch", "--format=%(refname:short)").split()
    assert branch not in remote_branches(remote)


def test_a_run_killed_after_its_merge_leaves_nothing_to_carry(remote, clone, github):
    branch = f"{RUN_BRANCH_PREFIX}2026-10-31-070000"
    git(clone, "switch", "--quiet", "-c", branch)
    (clone / "new digest.md").write_text("a Digest\n")
    git(clone, "add", ".")
    git(clone, "commit", "--quiet", "-m", "merged, then killed")
    git(clone, "push", "--quiet", "origin", branch)
    url = github.open_pull_request("main", branch, "title", "body")
    github.merge(url)

    leftovers = runner(clone, github).prepare()

    assert leftovers == []
    assert (clone / "new digest.md").read_text() == "a Digest\n"
    assert git(clone, "rev-parse", "HEAD") == git(remote, "rev-parse", "main")


def test_one_run_at_a_time(clone):
    with (
        Git(clone).locked(),
        pytest.raises(GitFailed, match="another run holds"),
        Git(clone).locked(),
    ):
        pass


def test_a_tool_missing_from_path_is_a_git_failure_not_a_crash(clone):
    with pytest.raises(GitFailed, match="could not start"):
        Git(clone).command("wikipol-no-such-tool", "pr", "list")

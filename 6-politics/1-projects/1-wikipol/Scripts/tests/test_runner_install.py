"""install-runner.sh and uninstall-runner.sh in their dry runs: what they would do, the plist they
would load, and that they touch neither launchd nor ~/Library. Fake gh, uv and claude stand in on
PATH; nothing is cloned, synced or loaded."""

from __future__ import annotations

import os
import plistlib
import re
import shutil
import subprocess
from pathlib import Path

import pytest

LAUNCHD = Path(__file__).resolve().parents[1] / "launchd"
LABEL = "com.diplow.wikipol.runner"
REPO_URL = "https://github.com/Diplow/diplow.git"


@pytest.fixture
def home(tmp_path):
    home = tmp_path / "home"
    home.mkdir()
    return home


@pytest.fixture
def env(tmp_path, home):
    tools = tmp_path / "bin"
    tools.mkdir()
    for name in ("gh", "uv", "claude"):
        fake = tools / name
        fake.write_text(f"#!/bin/sh\necho 'fake {name} must not run' >&2\nexit 99\n")
        fake.chmod(0o755)
    git_dir = Path(shutil.which("git")).parent
    return {
        "HOME": str(home),
        "PATH": f"{tools}:{git_dir}:/usr/bin:/bin",
        "TMPDIR": str(tmp_path),
        "WIKIPOL_RUNNER_REPO": REPO_URL,
    }


def script(name: str, env: dict[str, str], *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", str(LAUNCHD / name), *args],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_the_install_dry_run_only_prints_what_it_would_do(env, home, tmp_path):
    result = script("install-runner.sh", env, "--dry-run")

    assert result.returncode == 0, result.stderr
    commands = [line[2:] for line in result.stdout.splitlines() if line.startswith("+ ")]
    runner = home / "wikipol-runner"
    agent = home / "Library" / "LaunchAgents" / f"{LABEL}.plist"
    uid = os.getuid()
    assert commands[0] == f"git clone --branch main {REPO_URL} {runner}"
    assert f"git -C {runner} config wikipol.runner true" in commands
    assert f"uv --directory {runner}/6-politics/1-projects/1-wikipol/Scripts sync --frozen" in (
        commands
    )
    assert commands[-1] == f"launchctl bootstrap gui/{uid} {agent}"
    assert not runner.exists()
    assert not (home / "Library").exists()
    assert "fake" not in result.stderr  # no tool ran


def test_the_filled_plist_runs_wikipol_run_daily_in_the_runners_clone(env, home, tmp_path):
    result = script("install-runner.sh", env, "--dry-run")

    rendered = Path(re.search(r"filled plist: (\S+)", result.stdout).group(1))
    assert rendered.is_relative_to(tmp_path)
    agent = plistlib.loads(rendered.read_bytes())
    runner = home / "wikipol-runner"
    assert agent["Label"] == LABEL
    assert agent["ProgramArguments"] == [
        str(tmp_path / "bin" / "uv"),
        "--directory",
        f"{runner}/6-politics/1-projects/1-wikipol/Scripts",
        "run",
        "--frozen",
        "--quiet",
        "wikipol",
        "run",
    ]
    assert agent["WorkingDirectory"] == str(runner)
    # A calendar interval: launchd runs a job missed during sleep at the next wake.
    assert agent["StartCalendarInterval"] == {"Hour": 7, "Minute": 0}
    assert agent["RunAtLoad"] is False
    path = agent["EnvironmentVariables"]["PATH"].split(":")
    assert str(tmp_path / "bin") in path and "/usr/bin" in path
    assert agent["EnvironmentVariables"]["HOME"] == str(home)
    assert agent["StandardErrorPath"] == f"{home}/Library/Logs/wikipol/launchd.err.log"
    assert "@" not in rendered.read_text().split("<plist", 1)[1]  # every field filled


def test_the_install_follows_another_base_when_told(env, home):
    result = script("install-runner.sh", env, "--dry-run", "--base", "project/sources-from-youtube")

    assert result.returncode == 0, result.stderr
    assert f"+ git clone --branch project/sources-from-youtube {REPO_URL}" in result.stdout


def test_the_install_refuses_a_folder_that_isnt_a_clone(env, home):
    (home / "wikipol-runner").mkdir()

    result = script("install-runner.sh", env, "--dry-run")

    assert result.returncode == 1
    assert "exists and is not a clone" in result.stderr


def test_the_install_stops_when_a_tool_is_missing(env, tmp_path):
    (tmp_path / "bin" / "claude").unlink()

    result = script("install-runner.sh", env, "--dry-run")

    assert result.returncode == 1
    assert "claude is not on PATH" in result.stderr


def test_the_uninstall_dry_run_only_prints_what_it_would_do(env, home):
    result = script("uninstall-runner.sh", env, "--dry-run")

    assert result.returncode == 0, result.stderr
    agent = home / "Library" / "LaunchAgents" / f"{LABEL}.plist"
    assert f"+ launchctl bootout gui/{os.getuid()}/{LABEL} (when loaded)" in result.stdout
    assert f"+ rm -f {agent}" in result.stdout

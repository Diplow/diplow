"""Every test runs cut off from the real world: no env file, no credentials, no sockets."""

from __future__ import annotations

import shutil
from pathlib import Path
from textwrap import dedent

import pytest

PIPELINE_VARIABLES = (
    "WIKIPOL_S3_BUCKET",
    "WIKIPOL_S3_ENDPOINT",
    "WIKIPOL_S3_REGION",
    "SCW_ACCESS_KEY",
    "SCW_SECRET_KEY",
    "SCW_DEFAULT_PROJECT_ID",
    "WIKIPOL_DATABASE_URL",
    "WIKIPOL_EMBEDDING_API_KEY",
    "AWS_PROFILE",
)


@pytest.fixture(autouse=True)
def isolated_environment(monkeypatch, tmp_path):
    """Points WIKIPOL_ENV at a file that doesn't exist, so ~/.config/wikipol/.env is never read,
    and the cache at the test's own folder."""
    monkeypatch.setenv("WIKIPOL_ENV", str(tmp_path / "no-such.env"))
    monkeypatch.setenv("XDG_CACHE_HOME", str(tmp_path / "cache"))  # backfill's staging folder
    for name in PIPELINE_VARIABLES:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")


def write(path: Path, text: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dedent(text).lstrip("\n"), encoding="utf-8")
    return path


@pytest.fixture
def demo_tree(tmp_path):
    """A Source node, its frozen vault, and the transcripts its Drive folder holds.

    - `Avec id.md`: `youtube_id` in its frontmatter, date from its Videos note
    - `Avec url.md`: a `watch?v=` url, a title and a French date in its frontmatter
    - `Sans frontmatter.md`: id and date from the vault's inventory
    - `Lie par une fiche.md`: id and date from the Videos note that links it
    - `Orphelin.md`: nothing anywhere
    """
    sources = tmp_path / "2-sources"
    vault = tmp_path / "Legacy" / "Demo"
    write(
        sources / "1-demo" / "source.yaml",
        """
        source:
          name: Demo
          slug: demo
        legacy:
          vault: "../../Legacy/Demo"
        files:
          inventaire: "Sources/Inventaire.md"
        """,
    )
    write(
        vault / "Videos" / "Une fiche.md",
        """
        ---
        type: vidéo
        date: 2025-07-27
        youtube_id: aaaaaaaaaaa
        ---
        # Une fiche

        ## Transcript
        [[Avec id]]
        """,
    )
    write(
        vault / "Videos" / "Une autre fiche.md",
        """
        ---
        date: 2025-08-01
        youtube_id: ddddddddddd
        ---
        ## Transcript

        `Sources/Transcripts/Lie par une fiche.md`
        """,
    )
    watch = "[YouTube](https://www.youtube.com/watch?v="
    write(
        vault / "Sources" / "Inventaire.md",
        "\n".join(
            [
                "| Titre | URL | Date | Transcript | Fiche |",
                "| ----- | --- | ---- | ---------- | ----- |",
                f"| Sans : frontmatter, avec | une barre | {watch}ccccccccccc) | 2026-04-15 "
                "| [[Sans frontmatter]] | |",
                f"| Pas encore transcrite | {watch}eeeeeeeeeee) | 2026-04-14 | | |",
            ]
        ),
    )
    drive = tmp_path / "drive"
    write(
        drive / "Avec id.md",
        """
        ---
        date created: Tuesday, March 31st 2026, 4:44:49 pm
        youtube_id: aaaaaaaaaaa

        ---

        0:00

        Bonjour.
        """,
    )
    write(
        drive / "Avec url.md",
        """
        ---
        titre: "AVEC URL : LE VRAI TITRE !"
        date: "30 mars 2026"
        url: "https://www.youtube.com/watch?v=bbbbbbbbbbb"
        ---

        0:00

        Salut.
        """,
    )
    write(drive / "Sans frontmatter.md", "0:05\n\nGaza.\n")
    write(drive / "Lie par une fiche.md", "0:00\n\nLiée.\n")
    write(drive / "Orphelin.md", "0:00\n\nPersonne.\n")
    return {"sources": sources, "vault": vault, "drive": drive}


@pytest.fixture
def fake_fetch(demo_tree):
    """Stands in for rclone: copies the demo Drive folder, records what it was asked for."""
    calls: list[str] = []

    def fetch(remote: str, local: Path) -> None:
        calls.append(remote)
        for path in demo_tree["drive"].iterdir():
            shutil.copy(path, local / path.name)

    fetch.calls = calls
    return fetch

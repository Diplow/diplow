"""Where the pipeline's settings come from.

Two places. The pipeline's environment (the bucket, its credentials, the database) lives in
`~/.config/wikipol/.env`, outside the repo, so every clone and the launchd runner read the same
file; `WIKIPOL_ENV` points elsewhere. Each Source declares itself in the `source.yaml` of its
node under `6-politics/2-sources/`.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from dotenv import dotenv_values

from wikipol.raw_store import SLUG

DEFAULT_ENV_PATH = Path("~/.config/wikipol/.env")
DEFAULT_S3_REGION = "fr-par"

# src/wikipol/config.py -> parents: wikipol, src, Scripts, 1-wikipol, 1-projects, 6-politics
DEFAULT_SOURCES_DIR = Path(__file__).resolve().parents[5] / "2-sources"


class ConfigError(Exception):
    """A setting the pipeline needs is missing or malformed. Names the variable, never a value."""


@dataclass(frozen=True)
class Settings:
    s3_bucket: str
    s3_endpoint: str
    s3_region: str
    # Kept out of repr, so no log or traceback prints them.
    s3_access_key: str = field(repr=False)
    s3_secret_key: str = field(repr=False)


def read_environment(environ: Mapping[str, str] | None = None) -> tuple[dict[str, str], Path]:
    """The pipeline's variables, stripped: the env file first, the process environment over it."""
    environ = os.environ if environ is None else environ
    env_path = Path(environ.get("WIKIPOL_ENV") or DEFAULT_ENV_PATH).expanduser()
    values: dict[str, str] = {}
    if env_path.is_file():
        values.update({k: v for k, v in dotenv_values(env_path).items() if v is not None})
    values.update({k: v for k, v in environ.items() if v})
    return {k: v.strip() for k, v in values.items()}, env_path


def load_settings(environ: Mapping[str, str] | None = None) -> Settings:
    """The bucket and its credentials."""
    values, env_path = read_environment(environ)

    def required(name: str) -> str:
        value = values.get(name, "")
        if not value:
            raise ConfigError(f"{name} is not set, in {env_path} nor in the environment")
        return value

    return Settings(
        s3_bucket=required("WIKIPOL_S3_BUCKET"),
        s3_endpoint=required("WIKIPOL_S3_ENDPOINT"),
        s3_region=values.get("WIKIPOL_S3_REGION") or DEFAULT_S3_REGION,
        s3_access_key=required("SCW_ACCESS_KEY"),
        s3_secret_key=required("SCW_SECRET_KEY"),
    )


FETCHERS = ("yt-dlp", "transcript-api")


@dataclass(frozen=True)
class FetcherSettings:
    """Which Fetcher gets the Raws: yt-dlp, from the Mac's home IP, by default, since YouTube
    blocks datacenter IPs; the transcript API for a runner that has no home IP."""

    kind: str = "yt-dlp"
    transcript_api_key: str | None = field(default=None, repr=False)


def load_fetcher_settings(
    environ: Mapping[str, str] | None = None, kind: str | None = None
) -> FetcherSettings:
    """`kind`, the command line's `--fetcher`, wins over `WIKIPOL_FETCHER`, which wins over
    yt-dlp. The transcript API needs `WIKIPOL_TRANSCRIPT_API_KEY`."""
    values, env_path = read_environment(environ)
    kind = kind or values.get("WIKIPOL_FETCHER") or "yt-dlp"
    if kind not in FETCHERS:
        raise ConfigError(f"WIKIPOL_FETCHER must be one of {', '.join(FETCHERS)}, not {kind!r}")
    api_key = values.get("WIKIPOL_TRANSCRIPT_API_KEY") or None
    if kind == "transcript-api" and api_key is None:
        raise ConfigError(
            f"WIKIPOL_TRANSCRIPT_API_KEY is not set, in {env_path} nor in the environment"
        )
    return FetcherSettings(kind, api_key)


@dataclass(frozen=True)
class Source:
    """A Source as its `source.yaml` declares it."""

    name: str
    slug: str
    node: Path
    legacy_vault: Path | None
    legacy_inventory: Path | None
    channel_url: str | None = None


def load_source(node: Path) -> Source:
    path = node / "source.yaml"
    if not path.is_file():
        raise ConfigError(f"no source.yaml in {node}")
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as error:
        raise ConfigError(f"{path} is not valid YAML: {error}") from error
    source = data.get("source") if isinstance(data, dict) else None
    if not isinstance(source, dict):
        raise ConfigError(f"{path} has no `source:` mapping")
    name, slug = source.get("name"), source.get("slug")
    if not name or not slug:
        raise ConfigError(f"{path} lacks source.name or source.slug")
    if not SLUG.fullmatch(str(slug)):
        raise ConfigError(f"{path}: source.slug {slug!r} is not lowercase letters, digits and -")

    # An absent or empty block is {}; anything else that isn't a mapping is refused.
    legacy, files, youtube = (
        {} if data.get(name) is None else data[name] for name in ("legacy", "files", "youtube")
    )
    if not all(isinstance(block, dict) for block in (legacy, files, youtube)):
        raise ConfigError(f"{path}: `legacy:`, `files:` and `youtube:` must be mappings")
    channel_url = str(youtube.get("channel_url") or "").strip() or None
    vault_rel, inventory_rel = legacy.get("vault"), files.get("inventaire")
    vault = (node / str(vault_rel)).resolve() if vault_rel else None
    inventory = vault / str(inventory_rel) if vault and inventory_rel else None
    return Source(
        name=str(name),
        slug=str(slug),
        node=node.resolve(),
        legacy_vault=vault,
        legacy_inventory=inventory,
        channel_url=channel_url,
    )


def load_sources(sources_dir: Path = DEFAULT_SOURCES_DIR) -> list[Source]:
    """Every Source under `sources_dir`, in the order of their numbered nodes."""
    if not sources_dir.is_dir():
        raise ConfigError(f"no Sources folder at {sources_dir}")
    nodes = sorted(p.parent for p in sources_dir.glob("*/source.yaml"))
    sources = [load_source(node) for node in nodes]
    slugs = [s.slug for s in sources]
    shared = sorted({slug for slug in slugs if slugs.count(slug) > 1})
    if shared:
        raise ConfigError(f"two Sources share the slug {', '.join(shared)}")
    return sources

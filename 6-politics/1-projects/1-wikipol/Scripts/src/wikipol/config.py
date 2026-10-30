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


def load_settings(environ: Mapping[str, str] | None = None) -> Settings:
    """Read the pipeline's environment: the env file first, the process environment over it."""
    environ = os.environ if environ is None else environ
    env_path = Path(environ.get("WIKIPOL_ENV") or DEFAULT_ENV_PATH).expanduser()
    values: dict[str, str] = {}
    if env_path.is_file():
        values.update({k: v for k, v in dotenv_values(env_path).items() if v is not None})
    values.update({k: v for k, v in environ.items() if v})

    def required(name: str) -> str:
        value = values.get(name, "").strip()
        if not value:
            raise ConfigError(f"{name} is not set, in {env_path} nor in the environment")
        return value

    return Settings(
        s3_bucket=required("WIKIPOL_S3_BUCKET"),
        s3_endpoint=required("WIKIPOL_S3_ENDPOINT"),
        s3_region=values.get("WIKIPOL_S3_REGION", "").strip() or DEFAULT_S3_REGION,
        s3_access_key=required("SCW_ACCESS_KEY"),
        s3_secret_key=required("SCW_SECRET_KEY"),
    )


@dataclass(frozen=True)
class Source:
    """A Source as its `source.yaml` declares it."""

    name: str
    slug: str
    node: Path
    legacy_vault: Path | None
    legacy_inventory: Path | None


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

    vault_rel = (data.get("legacy") or {}).get("vault")
    vault = (node / vault_rel).resolve() if vault_rel else None
    inventory_rel = (data.get("files") or {}).get("inventaire")
    inventory = vault / inventory_rel if vault and inventory_rel else None
    return Source(
        name=name,
        slug=slug,
        node=node.resolve(),
        legacy_vault=vault,
        legacy_inventory=inventory,
    )


def load_sources(sources_dir: Path = DEFAULT_SOURCES_DIR) -> list[Source]:
    """Every Source under `sources_dir`, in the order of their numbered nodes."""
    if not sources_dir.is_dir():
        raise ConfigError(f"no Sources folder at {sources_dir}")
    nodes = sorted(p.parent for p in sources_dir.glob("*/source.yaml"))
    return [load_source(node) for node in nodes]

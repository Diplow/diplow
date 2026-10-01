"""
Helper pour charger et résoudre la configuration d'une source WikiPol.

Chaque source a un fichier source.yaml à sa racine. Ce module charge ce fichier
et expose les chemins absolus, slugs, URLs, etc.

Usage minimal :
    from source_config import load_source

    cfg = load_source("Sources/MaChaine")
    print(cfg.name, cfg.channel_url, cfg.tracking_file)
"""
import os
import sys
from dataclasses import dataclass


def _load_yaml(path: str) -> dict:
    """Charge un YAML. Fallback minimal si PyYAML absent."""
    try:
        import yaml  # type: ignore
    except ImportError:
        print("ERREUR : PyYAML requis. Installer avec : pip install pyyaml", file=sys.stderr)
        sys.exit(1)
    with open(path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f) or {}


@dataclass
class SourceConfig:
    # Identité
    name: str
    slug: str
    type: str
    attribution: str

    # YouTube
    channel_url: str
    channel_handle: str

    # Chemins (absolus, résolus depuis la racine de la source)
    source_root: str
    inventaire_path: str
    tracking_file: str
    transcripts_dir: str

    # Git
    git_repo: str
    default_branch: str
    ingest_branch_prefix: str

    # Claude
    default_model: str

    # Types de fiches activés (whitelist stricte de source.yaml:content_types).
    # Conserve la casse du yaml ("Individus", "Enjeux", …).
    enabled_content_types: list[str]

    def content_type_enabled(self, name: str) -> bool:
        """Renvoie True si le type `name` est activé pour cette source.

        Comparaison insensible à la casse pour tolérer "Enjeux", "enjeux", "ENJEUX".
        """
        target = name.lower()
        return any(t.lower() == target for t in self.enabled_content_types)


def _find_source_root(start: str) -> str:
    """Remonte depuis `start` jusqu'à trouver un source.yaml. Renvoie le dossier contenant."""
    current = os.path.abspath(start)
    while True:
        if os.path.isfile(os.path.join(current, "source.yaml")):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            raise FileNotFoundError(
                f"Aucun source.yaml trouvé depuis {start!r} en remontant. "
                "Passer le chemin explicitement via --source."
            )
        current = parent


def load_source(path: str | None = None) -> SourceConfig:
    """Charge la configuration d'une source.

    Si `path` est None, cherche un source.yaml en remontant depuis cwd.
    Si `path` pointe vers un dossier, charge <path>/source.yaml.
    Si `path` pointe vers un fichier .yaml, le charge directement.
    """
    if path is None:
        source_root = _find_source_root(os.getcwd())
        yaml_path = os.path.join(source_root, "source.yaml")
    else:
        path = os.path.abspath(path)
        if os.path.isdir(path):
            source_root = path
            yaml_path = os.path.join(path, "source.yaml")
        elif path.endswith(".yaml") or path.endswith(".yml"):
            yaml_path = path
            source_root = os.path.dirname(path)
        else:
            raise ValueError(f"Chemin invalide : {path!r}. Doit être un dossier ou un .yaml")

    if not os.path.isfile(yaml_path):
        raise FileNotFoundError(f"source.yaml introuvable : {yaml_path}")

    data = _load_yaml(yaml_path)
    src = data.get("source", {})
    yt = data.get("youtube", {})
    files = data.get("files", {})
    git = data.get("git", {})
    claude = data.get("claude", {})

    inventaire_rel = files.get("inventaire", "Sources/Inventaire.md")
    tracking_rel = files.get("chronologique", f"{src.get('slug', 'source').upper()}_CHRONOLOGIQUE.md")

    # Aplatit content_types: { raw: {Transcripts: true}, basic: {...}, advanced: {...} }
    # en une liste à plat des types activés.
    content_types = data.get("content_types", {}) or {}
    enabled: list[str] = []
    for tier_name in ("raw", "basic", "advanced"):
        tier = content_types.get(tier_name, {}) or {}
        for type_name, value in tier.items():
            if value:
                enabled.append(type_name)

    return SourceConfig(
        name=src.get("name", ""),
        slug=src.get("slug", ""),
        type=src.get("type", "youtube"),
        attribution=src.get("attribution", src.get("name", "")),
        channel_url=yt.get("channel_url", ""),
        channel_handle=yt.get("channel_handle", ""),
        source_root=source_root,
        inventaire_path=os.path.join(source_root, inventaire_rel),
        tracking_file=os.path.join(source_root, tracking_rel),
        transcripts_dir=os.path.join(source_root, "Sources", "Transcripts"),
        git_repo=git.get("repo", ""),
        default_branch=git.get("default_branch", "develop"),
        ingest_branch_prefix=git.get("ingest_branch_prefix", "ingest-batch/"),
        default_model=claude.get("default_model", "sonnet"),
        enabled_content_types=enabled,
    )


def parse_source_arg(argv: list[str]) -> SourceConfig:
    """Parse --source <path> depuis argv (sans le modifier), avec auto-détection en fallback.

    Helper commun à tous les scripts pour uniformiser l'interface CLI.
    """
    path = None
    if "--source" in argv:
        i = argv.index("--source")
        if i + 1 < len(argv):
            path = argv[i + 1]
    return load_source(path)


if __name__ == "__main__":
    # Debug : afficher la config résolue
    cfg = parse_source_arg(sys.argv[1:])
    for field in cfg.__dataclass_fields__:
        print(f"  {field:22s} = {getattr(cfg, field)!r}")

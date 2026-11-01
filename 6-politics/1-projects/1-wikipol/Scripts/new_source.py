#!/usr/bin/env python
"""
Bootstrap d'une nouvelle source WikiPol.

Usage:
    python Scripts/new_source.py --name "MaChaine" --slug "machaine" \
        --youtube-url "https://www.youtube.com/@MaChaine/videos"

Args optionnels :
    --handle "@MaChaine"           # handle YouTube (déduit de l'URL si absent)
    --attribution "la MaChaine"    # attribution collective dans les fiches
    --git-repo "user/repo"         # dépôt GitHub qui héberge WikiPol (défaut : Diplow/diplow)

Résultat : un nœud de source est créé sous `6-politics/2-sources/`, au premier
numéro libre (`<n>-machaine/`, six au plus : au-delà, regrouper d'abord), avec :
    - source.yaml                  (config paramétrique)
    - CLAUDE.md                    (contexte éditorial à remplir)
    - 1-chronicle/CLAUDE.md        (la Chronicle, vide, où le pipeline range les Digests)

Une source n'a plus de vault : les vaults Obsidian d'avant (PaduTeam, Boniface)
sont figés dans wikipol/Legacy/ depuis WIK-1.
"""
import os
import re
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WIKIPOL_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))
TEMPLATES_DIR = os.path.join(WIKIPOL_ROOT, "Templates")
REPO_ROOT = os.path.normpath(os.path.join(WIKIPOL_ROOT, "..", "..", ".."))
SOURCES_DIR = os.path.join(REPO_ROOT, "6-politics", "2-sources")
MAX_SOURCES = 6


def parse_args(argv):
    """Parse les arguments CLI. Retourne un dict."""
    args = {}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a.startswith("--"):
            key = a[2:]
            if i + 1 < len(argv) and not argv[i + 1].startswith("--"):
                args[key] = argv[i + 1]
                i += 2
            else:
                args[key] = True
                i += 1
        else:
            i += 1
    return args


def derive_handle(url: str) -> str:
    """Extrait @handle depuis une URL YouTube."""
    m = re.search(r'youtube\.com/(@[\w.-]+)', url)
    return m.group(1) if m else ""


def substitute(template: str, values: dict) -> str:
    """Substitue les placeholders {{KEY}} par les valeurs."""
    out = template
    for k, v in values.items():
        out = out.replace("{{" + k + "}}", str(v))
    return out


def render_template(template_path: str, out_path: str, values: dict):
    with open(template_path, 'r', encoding='utf-8') as f:
        content = f.read()
    content = substitute(content, values)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(content)


def next_free_number(sources_dir: str) -> int:
    """Le premier numéro de 1 à 6 qu'aucun nœud de `sources_dir` ne porte."""
    taken = set()
    if os.path.isdir(sources_dir):
        for entry in os.listdir(sources_dir):
            m = re.match(r'^(\d+)-', entry)
            if m and os.path.isdir(os.path.join(sources_dir, entry)):
                taken.add(int(m.group(1)))
    for n in range(1, MAX_SOURCES + 1):
        if n not in taken:
            return n
    print(f"ERREUR : {sources_dir} tient déjà {MAX_SOURCES} sources. "
          "Les regrouper d'abord (règle des six, voir son CLAUDE.md).")
    sys.exit(1)


def create_source(name: str, slug: str, channel_url: str, handle: str,
                  attribution: str, git_repo: str):
    for entry in os.listdir(SOURCES_DIR) if os.path.isdir(SOURCES_DIR) else []:
        if re.sub(r'^\d+-', '', entry) == slug:
            print(f"ERREUR : la source {slug!r} existe déjà ({os.path.join(SOURCES_DIR, entry)}).")
            sys.exit(1)

    node = f"{next_free_number(SOURCES_DIR)}-{slug}"
    source_dir = os.path.join(SOURCES_DIR, node)
    node_path = os.path.relpath(source_dir, REPO_ROOT).replace(os.sep, "/")

    values = {
        "SOURCE_NAME": name,
        "SOURCE_SLUG": slug,
        "SOURCE_ATTRIBUTION": attribution,
        "CHANNEL_URL": channel_url,
        "CHANNEL_HANDLE": handle,
        "GIT_REPO": git_repo,
        "SLUG_UPPER": slug.upper().replace("-", "_"),
        "NODE_PATH": node_path,
    }

    # 1. source.yaml
    render_template(
        os.path.join(TEMPLATES_DIR, "source.yaml.tmpl"),
        os.path.join(source_dir, "source.yaml"),
        values,
    )

    # 2. CLAUDE.md (contexte éditorial)
    render_template(
        os.path.join(TEMPLATES_DIR, "source_CLAUDE.md.tmpl"),
        os.path.join(source_dir, "CLAUDE.md"),
        values,
    )

    # 3. La Chronicle, vide
    render_template(
        os.path.join(TEMPLATES_DIR, "chronicle_CLAUDE.md.tmpl"),
        os.path.join(source_dir, "1-chronicle", "CLAUDE.md"),
        values,
    )

    return source_dir


def print_next_steps(source_dir: str):
    rel = os.path.relpath(source_dir, REPO_ROOT).replace(os.sep, "/")
    print(f"\n✓ Source créée : {rel}\n")
    print("Prochaines étapes :")
    print()
    print("1. Remplir le contexte éditorial")
    print(f"   $EDITOR {rel}/CLAUDE.md")
    print()
    print("2. Ajouter la source à la liste de 6-politics/2-sources/CLAUDE.md")
    print()


def main():
    args = parse_args(sys.argv[1:])
    if "name" not in args or "youtube-url" not in args:
        print("ERREUR : --name et --youtube-url sont obligatoires.")
        print("Exemple :")
        print('  python Scripts/new_source.py --name "MaChaine" --slug "machaine" \\')
        print('      --youtube-url "https://www.youtube.com/@MaChaine/videos"')
        sys.exit(1)

    name = args["name"]
    slug = args.get("slug") or re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    channel_url = args["youtube-url"]
    handle = args.get("handle") or derive_handle(channel_url)
    attribution = args.get("attribution") or name
    git_repo = args.get("git-repo", "Diplow/diplow")

    print(f"Nouvelle source WikiPol")
    print(f"  name        : {name}")
    print(f"  slug        : {slug}")
    print(f"  channel_url : {channel_url}")
    print(f"  handle      : {handle}")
    print(f"  attribution : {attribution}")
    print(f"  git_repo    : {git_repo or '(non défini)'}")
    print()

    source_dir = create_source(
        name, slug, channel_url, handle, attribution, git_repo
    )
    print_next_steps(source_dir)


if __name__ == "__main__":
    main()

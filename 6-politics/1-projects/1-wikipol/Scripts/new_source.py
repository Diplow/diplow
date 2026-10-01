#!/usr/bin/env python
"""
Bootstrap d'une nouvelle source WikiPol.

Usage:
    python Scripts/new_source.py --name "MaChaine" --slug "machaine" \
        --youtube-url "https://www.youtube.com/@MaChaine/videos"

Args optionnels :
    --handle "@MaChaine"           # handle YouTube (déduit de l'URL si absent)
    --attribution "la MaChaine"    # attribution collective dans les fiches
    --git-repo "user/repo"         # dépôt GitHub pour cette source

Résultat : Sources/MaChaine/ est créé avec :
    - source.yaml                  (config paramétrique)
    - CLAUDE.md                    (contexte éditorial à remplir)
    - BUILD.md                     (taxonomie locale à construire)
    - MACHAINE_CHRONOLOGIQUE.md    (fichier de suivi vide)
    - Sources/Inventaire.md        (inventaire vide)
    - .obsidian/                   (pour qu'Obsidian reconnaisse le vault)
    - Un dossier par type de fiche activé dans source.yaml:content_types
      (par défaut : Videos, Individus, Organisations, Concepts, Enjeux,
       Sources/Transcripts ; voir BUILD.md de WikiPol pour les types optionnels).
"""
import os
import re
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WIKIPOL_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))
TEMPLATES_DIR = os.path.join(WIKIPOL_ROOT, "Templates")
SOURCES_DIR = os.path.join(WIKIPOL_ROOT, "Sources")

# Types activés par défaut pour une nouvelle source. Doit rester aligné avec
# le bloc `content_types:` de Templates/source.yaml.tmpl.
# Voir BUILD.md de WikiPol pour la classification raw/basic/advanced.
DEFAULT_ENABLED_TYPES = [
    "Transcripts",   # raw
    "Individus",     # basic
    "Organisations", # basic
    "Concepts",      # basic
    "Videos",        # basic
    "Enjeux",        # advanced
]


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


def create_source(name: str, slug: str, channel_url: str, handle: str,
                  attribution: str, git_repo: str):
    source_dir = os.path.join(SOURCES_DIR, name)
    if os.path.exists(source_dir):
        print(f"ERREUR : {source_dir} existe déjà. Supprimer ou choisir un autre nom.")
        sys.exit(1)

    slug_upper = slug.upper().replace("-", "_")

    values = {
        "SOURCE_NAME": name,
        "SOURCE_SLUG": slug,
        "SOURCE_ATTRIBUTION": attribution,
        "CHANNEL_URL": channel_url,
        "CHANNEL_HANDLE": handle,
        "GIT_REPO": git_repo,
        "SLUG_UPPER": slug_upper,
    }

    # 1. Dossiers : un par type activé (sauf Transcripts → Sources/Transcripts).
    #    + `Sources/` pour Inventaire et Transcripts ; `.obsidian/` pour le vault.
    os.makedirs(os.path.join(source_dir, "Sources"), exist_ok=True)
    os.makedirs(os.path.join(source_dir, ".obsidian"), exist_ok=True)
    for type_name in DEFAULT_ENABLED_TYPES:
        if type_name == "Transcripts":
            os.makedirs(os.path.join(source_dir, "Sources", "Transcripts"), exist_ok=True)
        else:
            os.makedirs(os.path.join(source_dir, type_name), exist_ok=True)

    # 2. source.yaml
    render_template(
        os.path.join(TEMPLATES_DIR, "source.yaml.tmpl"),
        os.path.join(source_dir, "source.yaml"),
        values,
    )

    # 3. CLAUDE.md (contexte éditorial)
    render_template(
        os.path.join(TEMPLATES_DIR, "source_CLAUDE.md.tmpl"),
        os.path.join(source_dir, "CLAUDE.md"),
        values,
    )

    # 4. BUILD.md (taxonomie locale)
    render_template(
        os.path.join(TEMPLATES_DIR, "source_BUILD.md.tmpl"),
        os.path.join(source_dir, "BUILD.md"),
        values,
    )

    # 5. Fichier de suivi chronologique vide
    tracking_filename = f"{slug_upper}_CHRONOLOGIQUE.md"
    tracking_path = os.path.join(source_dir, tracking_filename)
    with open(tracking_path, 'w', encoding='utf-8') as f:
        f.write(
            f"# {name} — Ingestion chronologique\n\n"
            f"Fichier de suivi vide. Générer les batches avec :\n\n"
            f"```\npython Scripts/generate_chronological.py --source Sources/{name}\n```\n"
        )

    # 6. Inventaire vide
    inventaire_path = os.path.join(source_dir, "Sources", "Inventaire.md")
    with open(inventaire_path, 'w', encoding='utf-8') as f:
        f.write(
            f"# Inventaire {name}\n\n"
            f"> 0 vidéos extraites depuis la page YouTube [{handle}]({channel_url})\n"
            f"> Dernière mise à jour : (jamais)\n\n"
            f"| Titre | URL | Date | Transcript | Fiche |\n"
            f"| ----- | --- | ---- | ---------- | ----- |\n"
        )

    # 7. .obsidian/ minimal (pour reconnaissance du vault)
    with open(os.path.join(source_dir, ".obsidian", "app.json"), 'w', encoding='utf-8') as f:
        f.write("{}\n")

    return source_dir, tracking_filename


def print_next_steps(source_dir: str, name: str, tracking_filename: str):
    rel = os.path.relpath(source_dir, WIKIPOL_ROOT).replace(os.sep, "/")
    print(f"\n✓ Source créée : {source_dir}\n")
    print(f"  Types activés (content_types dans source.yaml) :")
    print(f"    {', '.join(DEFAULT_ENABLED_TYPES)}")
    print(f"  Pour activer Livres / Evenements / Conjonctures / Possibles / Methodes,")
    print(f"  passer le type à `true` dans {rel}/source.yaml et créer le dossier.")
    print()
    print("Prochaines étapes :")
    print()
    print(f"1. Remplir le contexte éditorial")
    print(f"   $EDITOR {rel}/CLAUDE.md")
    print()
    print(f"2. Initialiser la taxonomie (optionnel — se construit aussi par induction)")
    print(f"   $EDITOR {rel}/BUILD.md")
    print()
    print(f"3. Découvrir les vidéos et peupler l'inventaire")
    print(f"   python Scripts/batch_transcripts.py --source {rel} --discover")
    print()
    print(f"4. Extraire quelques transcripts (tester d'abord)")
    print(f"   python Scripts/batch_transcripts.py --source {rel} --last 3")
    print()
    print(f"5. Générer le fichier chronologique")
    print(f"   python Scripts/generate_chronological.py --source {rel}")
    print()
    print(f"6. Lancer l'ingestion")
    print(f"   python Scripts/run_ingest.py --source {rel} --batch 1 --dry-run")
    print(f"   python Scripts/run_ingest.py --source {rel} --batch 1")
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
    git_repo = args.get("git-repo", "")

    print(f"Nouvelle source WikiPol")
    print(f"  name        : {name}")
    print(f"  slug        : {slug}")
    print(f"  channel_url : {channel_url}")
    print(f"  handle      : {handle}")
    print(f"  attribution : {attribution}")
    print(f"  git_repo    : {git_repo or '(non défini)'}")
    print()

    source_dir, tracking_filename = create_source(
        name, slug, channel_url, handle, attribution, git_repo
    )
    print_next_steps(source_dir, name, tracking_filename)


if __name__ == "__main__":
    main()
